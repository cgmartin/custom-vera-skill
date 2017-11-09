'use strict';
const utils = require('../lib/utils');

/**
 * Context property object for use with `createResponseObj(props, ...)`
 */
function createContextProperty(namespace, name, value, uncertaintyMs = 0) {
  const property = {
    namespace,
    name,
    value,
    timeOfSample: new Date().toISOString(),
    uncertaintyInMilliseconds: uncertaintyMs
  };
  return property;
}

/**
 * Create an Alexa Smart Home Skill response object
 *
 * @param {array} props context properties
 * @param {string} endpointId device endpoint id "{controllerId}-{device|scene}-{dId}"
 * @param {string} correlationToken tracking Id
 * @param {string} namespace home skill namespace
 * @param {string} name response name
 */
function createResponseObj(props, endpointId, correlationToken, namespace = 'Alexa', name = 'Response') {
  const response = {
    context: {
      properties: props
    },
    event: {
      header: {
        namespace,
        name,
        payloadVersion: '3',
        messageId: utils.uuid()
      },
      endpoint: {
        endpointId
      },
      payload: {
        cause: {
          type: 'VOICE_INTERACTION' // TODO
        },
        timestamp: new Date().toISOString()
      }
    }
  };
  if (correlationToken) {
    response.event.header.correlationToken = correlationToken;
  }
  return response;
}

/**
 * Create an Alexa Smart Home Skill error response
 * @param {object} err Error
 * @param {string} correlationToken passed in from request
 * @param {string} endpointId device endpoint id "{controllerId}-{device|scene}-{dId}"
 */
function createErrorResponse(err, correlationToken, endpointId) {
  const errType = err.type || 'INTERNAL_ERROR';
  utils.log(errType, err.message + (err.stack || ''));
  const response = {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'ErrorResponse',
        messageId: utils.uuid(),
        payloadVersion: '3'
      },
      payload: {
        type: errType,
        message: err.message
      }
    }
  };
  if (correlationToken) {
    response.event.header.correlationToken = correlationToken;
  }
  if (endpointId) {
    response.event.endpoint = {endpointId};
  }
  if (err.validRange) {
    response.event.payload.validRange = err.validRange;
  }
  return response;
}

/**
 * Create a response for Discovery requests
 *
 * @param {array} endpoints discovery endpoints
 */
function createDiscoveryResponseObj(endpoints) {
  return {
    event: {
      header: {
        namespace: 'Alexa.Discovery',
        name: 'Discover.Response',
        payloadVersion: '3',
        messageId: utils.uuid()
      },
      payload: {
        endpoints: endpoints || []
      }
    }
  };
}

module.exports = {
  createContextProperty,
  createResponseObj,
  createErrorResponse,
  createDiscoveryResponseObj
};
