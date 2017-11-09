'use strict';
// Change the `endpointId` to match your Vera setup:
//    endpointId = '{controllerId}-{device|scene}-{deviceId}'
module.exports = {
  'directive': {
    'header': {
      'namespace': 'Alexa',
      'name': 'ReportState',
      'payloadVersion': '3',
      'messageId': '1bd5d003-31b9-476f-ad03-71d471922820',
      'correlationToken': 'dFMb0z+PgpgdDmluhJ1LddFvSqZ/jCc8ptlAKulUj90jSqg=='
    },
    'endpoint': {
      'endpointId': '00000000-device-97',
      'cookie': {},
      'scope': {
        'type': 'BearerToken',
        'token': 'access-token-from-skill'
      }
    },
    'payload': {}
  }
};
