'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function sceneHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, sId] = endpointId.split('-');

  // Retrieve the scene info from vera
  return utils.isEndpointTypeValid(endpointId, endpointType, 'scene')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findSceneInSummaryData(sId, sData), sData, cInfo]))
    .then(([s, sData, cInfo]) => controlScene(s, sData, cInfo, directive, vera))
    .then(([props, eventName]) => res.createResponseObj(
      props, endpointId, correlationToken, 'Alexa.SceneController', eventName)
    );
};

function controlScene(s, sData, cInfo, directive, vera) {
  // TODO: Verify that the scene only contains allowed secure devices within it
  // https://developer.amazon.com/docs/smarthome/provide-scenes-in-a-smart-home-skill.html#allowed-devices
  if (Number(s.paused) === 1) {
    return Promise.reject(utils.error('ENDPOINT_UNREACHABLE', `Endpoint scene is paused: ${s.id}`));
  }

  return vera.listScene(cInfo, s.id)
    .then((sList) => checkSceneSecureDevices(sList))
    .then(() => activateScene(s, cInfo, vera));
}

function checkSceneSecureDevices(sList) {
  if (utils.sceneHasForbiddenDevices(sList.groups)) {
    return Promise.reject(utils.error('NO_SUCH_ENDPOINT', 'Scene contains insecure devices'));
  }
  return true;
}

function activateScene(s, cInfo, vera) {
  // Send the scene activation request
  return vera.runScene(cInfo, s.id)
    .then(() => [
      [res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'})],
      'ActivationStarted'
    ]);
}
