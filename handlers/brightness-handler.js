'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function brightnessHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const payload = request.directive.payload;
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device info from vera
  return utils.isEndpointTypeValid(endpointId, endpointType, 'device')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findDeviceInSummaryData(dId, sData), sData, cInfo]))
    .then(([d, sData, cInfo]) => changeBrightness(d, sData, cInfo, directive, payload, vera))
    .then((props) => res.createResponseObj(props, endpointId, correlationToken));
};

function changeBrightness(d, sData, cInfo, directive, payload, vera) {
  // Verify that the device is capable of power on/off actions
  if (Number(d.category) !== 2) {
    return Promise.reject(utils.error('INVALID_VALUE', `Directive is not supported for this device: ${d.id}`));
  }

  // Set or Adjust
  let action = null;
  if (directive === 'SetBrightness') {
    action = setBrightness(d.id, cInfo, payload, vera);
  } else if (directive === 'AdjustBrightness') {
    action = adjustBrightness(d.id, cInfo, payload, vera);
  } else {
    return Promise.reject(utils.error('INVALID_DIRECTIVE', `Unsupported directive: ${directive}`));
  }

  // Adjust power, and get new status
  return action
    .then((level) => {
      return [
        res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
        res.createContextProperty('Alexa.BrightnessController', 'brightness', Number(level), 1000)
      ];
    });
}

function setBrightness(dId, cInfo, payload, vera) {
  return vera.dimLight(cInfo, dId, payload.brightness)
    .then(() => payload.brightness);
}

function adjustBrightness(dId, cInfo, payload, vera) {
  return vera.getDimLevel(cInfo, dId)
    .then((level) => {
      const brightness = utils.clamp(Number(level) + payload.brightnessDelta, 0, 100);
      return vera.dimLight(cInfo, dId, brightness).then(() => brightness);
    });
}
