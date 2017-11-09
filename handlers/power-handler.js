'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function powerHandler(vera, request, context, callback) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device info from vera
  utils.isEndpointTypeValid(endpointId, endpointType, 'device')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findDeviceInSummaryData(dId, sData), sData, cInfo]))
    .then(([d, sData, cInfo]) => changePower(d, sData, cInfo, directive, vera))
    .then((props) => callback(null, res.createResponseObj(props, endpointId, correlationToken)))
    .catch((err) => callback(null, res.createErrorResponse(err, correlationToken, endpointId)));
};

function changePower(d, sData, cInfo, directive, vera) {
  // Verify that the device is capable of power on/off actions
  if ([2, 3].indexOf(Number(d.category)) === -1) {
    return Promise.reject(utils.error('INVALID_VALUE', `Directive is not supported for this device: ${d.id}`));
  }

  // On or Off
  let action = null;
  if (directive === 'TurnOn') {
    action = vera.turnSwitchOn(cInfo, d.id).then(() => 1);
  } else if (directive === 'TurnOff') {
    action = vera.turnSwitchOff(cInfo, d.id).then(() => 0);
  } else {
    return Promise.reject(utils.error('INVALID_DIRECTIVE', `Unsupported directive: ${directive}`));
  }

  // Adjust power, and get new status
  return action
    .then((state) => {
      return [
        res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
        res.createContextProperty('Alexa.PowerController', 'powerState', Number(state) === 1 ? 'ON' : 'OFF', 1000)
      ];
    });
}
