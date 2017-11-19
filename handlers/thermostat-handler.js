'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function thermostatHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const payload = request.directive.payload;
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device info from vera
  return utils.isEndpointTypeValid(endpointId, endpointType, 'device')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findDeviceInSummaryData(dId, sData), sData, cInfo]))
    .then(([d, sData, cInfo]) => changeThermostat(d, sData, cInfo, directive, payload, vera))
    .then((props) => res.createResponseObj(props, endpointId, correlationToken));
};

function changeThermostat(d, sData, cInfo, directive, payload, vera) {
  const veraScale = sData.temperature;

  // Verify that the device is capable of thermostat actions
  if ([5].indexOf(Number(d.category)) === -1) {
    return Promise.reject(utils.error('INVALID_VALUE', `Directive is not supported for this device: ${d.id}`));
  }

  // Set or Adjust
  // TODO: Support Dual Setpoints
  let action = null;
  if (directive === 'SetTargetTemperature') {
    action = setTargetTemperature(d, cInfo, sData, payload, vera);
  } else if (directive === 'AdjustTargetTemperature') {
    action = adjustTargetTemperature(d, cInfo, sData, payload, vera);
  } else if (directive === 'SetThermostatMode') {
    action = setThermostatMode(d, cInfo, payload, vera);
  } else {
    return Promise.reject(utils.error('INVALID_DIRECTIVE', `Unsupported directive: ${directive}`));
  }

  // Run action and report new status
  return action
    .then(([setpoint, mode]) => {
      const targetSetpoint = {
        value: setpoint,
        scale: utils.tstatScaleVeraToAlexa(veraScale)
      };
      return [
        res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
        res.createContextProperty('Alexa.ThermostatController', 'targetSetpoint', targetSetpoint, 3000),
        res.createContextProperty('Alexa.ThermostatController', 'thermostatMode', utils.tstatModeVeraToAlexa(mode), 3000)
      ];
    });
}

function setTargetTemperature(d, cInfo, sData, payload, vera) {
  const veraScale = sData.temperature;
  const alexaScale = utils.tstatScaleAlexaToVera(payload.targetSetpoint.scale);
  const setpoint = utils.convertTemperature(
    payload.targetSetpoint.value, alexaScale, veraScale
  );
  return vera.setTargetTemperature(cInfo, d.id, setpoint)
    .then(() => [setpoint, d.mode]);
}

function adjustTargetTemperature(d, cInfo, sData, payload, vera) {
  const veraScale = sData.temperature;
  const alexaScale = utils.tstatScaleAlexaToVera(payload.targetSetpointDelta.scale);
  const setpoint = Number(d.setpoint) + utils.convertTemperatureDelta(
    payload.targetSetpointDelta.value, alexaScale, veraScale
  );
  return vera.setTargetTemperature(cInfo, d.id, setpoint)
    .then(() => [setpoint, d.mode]);
}

function setThermostatMode(d, cInfo, payload, vera) {
  let veraMode = utils.tstatModeAlexaToVera(payload.thermostatMode.value);
  return vera.setThermostatMode(cInfo, d.id, veraMode)
    .then(() => [d.setpoint, veraMode]);
}
