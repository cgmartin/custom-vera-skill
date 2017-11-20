'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function powerLevelHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const payload = request.directive.payload;
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device info from vera
  return utils.isEndpointTypeValid(endpointId, endpointType, 'device')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findDeviceInSummaryData(dId, sData), sData, cInfo]))
    .then(([d, sData, cInfo]) => changePowerLevel(d, sData, cInfo, directive, payload, vera))
    .then((props) => res.createResponseObj(props, endpointId, correlationToken));
};

function changePowerLevel(d, sData, cInfo, directive, payload, vera) {
  // Verify that the device is capable of power on/off actions
  if (Number(d.category) !== 2) {
    return Promise.reject(utils.error('INVALID_VALUE', `Directive is not supported for this device: ${d.id}`));
  }

  // Set or Adjust
  let action = null;
  if (directive === 'SetPowerLevel') {
    action = setPowerLevel(d.id, cInfo, payload, vera);
  } else if (directive === 'AdjustPowerLevel') {
    action = adjustPowerLevel(d.id, cInfo, payload, vera);
  } else {
    return Promise.reject(utils.error('INVALID_DIRECTIVE', `Unsupported directive: ${directive}`));
  }

  // Adjust power, and get new status
  return action
    .then((level) => {
      return [
        res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
        res.createContextProperty('Alexa.PowerLevelController', 'powerLevel', Number(level), 1000)
      ];
    });
}

function setPowerLevel(dId, cInfo, payload, vera) {
  return vera.dimLight(cInfo, dId, payload.powerLevel)
    .then(() => payload.powerLevel);
}

function adjustPowerLevel(dId, cInfo, payload, vera) {
  return vera.getDimLevel(cInfo, dId)
    .then((level) => {
      const powerLevel = utils.clamp(Number(level) + payload.powerLevelDelta, 0, 100);
      return vera.dimLight(cInfo, dId, powerLevel).then(() => powerLevel);
    });
}
