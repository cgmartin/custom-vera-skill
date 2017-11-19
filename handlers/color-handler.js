'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function colorHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const payload = request.directive.payload;
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device info from vera
  return utils.isEndpointTypeValid(endpointId, endpointType, 'device')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findDeviceInSummaryData(dId, sData), sData, cInfo]))
    .then(([d, sData, cInfo]) => changeColor(d, sData, cInfo, directive, payload, vera))
    .then((props) => res.createResponseObj(props, endpointId, correlationToken));
};

function changeColor(d, sData, cInfo, directive, payload, vera) {
  // Verify that the device is capable of power on/off actions
  if ([2].indexOf(Number(d.category)) === -1) {
    return Promise.reject(utils.error('INVALID_VALUE', `Directive is not supported for this device: ${d.id}`));
  }

  // Set or Adjust
  let action = null;
  if (directive === 'SetColor') {
    action = setColor(d.id, cInfo, payload.color, vera);
  } else {
    return Promise.reject(utils.error('INVALID_DIRECTIVE', `Unsupported directive: ${directive}`));
  }

  // Adjust power, and get new status
  return action
    .then((color) => {
      return [
        res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
        res.createContextProperty('Alexa.ColorController', 'color', color, 1000)
      ];
    });
}

function setColor(dId, cInfo, color, vera) {
  const {r, g, b} = utils.convertHsvToRgb(color.hue, color.saturation, color.brightness);
  return vera.setRGBColor(cInfo, dId, r, g, b)
    .then(() => color);
}
