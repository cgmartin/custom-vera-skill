'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function reportStateHandler(vera, request, context, callback) {
  const correlationToken = request.directive.header.correlationToken;
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device/scene info from vera
  vera.getSummaryDataById(ctrlId)
    .then(([sData]) => reportState(dId, sData, endpointType))
    .then((props) => callback(null, res.createResponseObj(props, endpointId, correlationToken, 'Alexa', 'StateReport')))
    .catch((err) => callback(null, res.createErrorResponse(err, correlationToken, endpointId)));
};

function reportState(dId, sData, endpointType) {
  // device or scene state?
  if (endpointType === 'device') {
    return utils.findDeviceInSummaryData(dId, sData)
      .then((d) => createDeviceStateContextProps(d, sData));
  } else if (endpointType === 'scene') {
    return utils.findSceneInSummaryData(dId, sData)
      .then((s) => createSceneStateContextProps(s, sData));
  }
  return Promise.reject(utils.error('NO_SUCH_ENDPOINT', `Unknown endpoint type: ${endpointType}`));
}

function createDeviceStateContextProps(d, sData) {
  switch (d['category']) {
    case 2: return createDimmerContextProps(d);
    case 3: return createSwitchContextProps(d);
    case 5: return createThermostatContextProps(d, sData);
    case 6: return createCameraContextProps(d);
    case 7: return createLockContextProps(d);
    case 17: return createTemperatureSensorContextProps(d, sData);
    default: return [];
  }
}

function createDimmerContextProps(d) {
  const properties = [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.PowerController', 'powerState', Number(d.status) === 1 ? 'ON' : 'OFF'),
    res.createContextProperty('Alexa.PowerLevelController', 'powerLevel', Number(d.level)),
    res.createContextProperty('Alexa.BrightnessController', 'brightness', Number(d.level))
  ];
  // TODO: light with color.
  // if (Number(d.subcategory) === 4 && d.color) {
  //   properties.push(res.createContextProperty('Alexa.ColorController', 'color', d.color));
  // }
  return properties;
}

function createSwitchContextProps(d) {
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.PowerController', 'powerState', Number(d.status) === 1 ? 'ON' : 'OFF')
  ];
}

function createThermostatContextProps(d, sData) {
  const tempScale = utils.tstatScaleVeraToAlexa(sData.temperature);
  const targetSetpoint = {value: Number(d.setpoint), scale: tempScale};
  const temperature = {value: Number(d.temperature), scale: tempScale};
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.ThermostatController', 'targetSetpoint', targetSetpoint),
    res.createContextProperty('Alexa.ThermostatController', 'thermostatMode', utils.tstatModeVeraToAlexa(d.mode)),
    res.createContextProperty('Alexa.TemperatureSensor', 'temperature', temperature)
  ];
}

function createCameraContextProps(_d) {
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'})
  ];
}

function createLockContextProps(d) {
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.LockController', 'lockState', Number(d.locked) ? 'LOCKED' : 'UNLOCKED')
  ];
}

function createTemperatureSensorContextProps(d, sData) {
  const temperature = {value: Number(d.temperature), scale: utils.tstatScaleVeraToAlexa(sData.temperature)};
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.TemperatureSensor', 'temperature', temperature)
  ];
}

function createSceneStateContextProps(s, sData) {
  // TODO: Verify that the scene only contains allowed secure devices within it
  // https://developer.amazon.com/docs/smarthome/provide-scenes-in-a-smart-home-skill.html#allowed-devices
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'})
  ];
}
