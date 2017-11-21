'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function lockHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device info from vera
  return utils.isEndpointTypeValid(endpointId, endpointType, 'device')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findDeviceInSummaryData(dId, sData), sData, cInfo]))
    .then(([d, sData, cInfo]) => changeLock(d, sData, cInfo, directive, vera))
    .then((props) => res.createResponseObj(props, endpointId, correlationToken));
};

function changeLock(d, sData, cInfo, directive, vera) {
  // Verify that the device is capable of power on/off actions
  if (Number(d.category) !== 7) {
    return Promise.reject(utils.error('INVALID_VALUE', `Directive is not supported for this device: ${d.id}`));
  }

  // On or Off
  let action = null;
  if (directive === 'Lock') {
    action = vera.setLockState(cInfo, d.id, 1).then(() => 'LOCKED');
  } else if (directive === 'Unlock') {
    action = vera.setLockState(cInfo, d.id, 0).then(() => 'UNLOCKED');
  } else {
    return Promise.reject(utils.error('INVALID_DIRECTIVE', `Unsupported directive: ${directive}`));
  }

  // Adjust power, and get new status
  return action
    .then((state) => {
      return [
        res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
        res.createContextProperty('Alexa.LockController', 'lockState', state, 3000)
      ];
    });
}
