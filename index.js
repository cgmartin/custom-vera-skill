'use strict';
/**
 * For more information about developing smart home skills, see
 *  https://developer.amazon.com/alexa/smart-home
 *
 * For details on the smart home API, please visit
 *  https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/smart-home-skill-api-reference
 *  https://github.com/alexa/alexa-smarthome
 *
 * Vera API docs:
 *  http://wiki.micasaverde.com/index.php/Luup_Device_Categories
 *  http://wiki.micasaverde.com/index.php/Luup_Devices
 *  http://wiki.micasaverde.com/index.php/Luup_Requests
 *  http://wiki.micasaverde.com/index.php/Luup_UPnP_Variables_and_Actions
 */
const config = require('./lib/config');
const utils = require('./lib/utils');
const responses = require('./lib/responses');
const Vera = require('./lib/vera');
const S3VeraCache = require('./lib/s3-vera-cache');
const discoveryHandler = require('./handlers/discovery-handler');
const reportStateHandler = require('./handlers/report-state-handler');
const sceneHandler = require('./handlers/scene-handler');
const powerHandler = require('./handlers/power-handler');
const powerLevelHandler = require('./handlers/power-level-handler');
const lockHandler = require('./handlers/lock-handler');
const thermostatHandler = require('./handlers/thermostat-handler');

/**
 * Main entry point.
 * Incoming events from Alexa service through Smart Home API are all handled by this function.
 *
 * It is recommended to validate the request and response with Alexa Smart Home Skill API Validation package.
 *  https://github.com/alexa/alexa-smarthome-validation
 */
exports.handler = (request, context, cb) => {

  // Log response before finishing
  function callback(err, res) {
    utils.log('DEBUG', `Response: ${JSON.stringify(res)}`);
    cb(err, res);
  }

  // TODO: validate auth?
  // https://developer.amazon.com/docs/custom-skills/link-an-alexa-user-with-a-user-in-your-system.html
  // https://developer.amazon.com/docs/login-with-amazon/obtain-customer-profile.html
  // request.directive.payload.scope.token

  // Initialize the vera service
  let veraCache = null;
  if (config.veraCacheS3Bucket) {
    veraCache = new S3VeraCache({
      s3Bucket: config.veraCacheS3Bucket,
      s3Key: config.veraCacheS3Key,
      s3Region: config.veraCacheS3Region,
      ttl: config.veraCacheTtl
    });
  }
  const vera = new Vera({
    userId: config.veraUserId,
    password: config.veraPassword,
    passwordHash: config.veraPasswordHash,
    ttl: config.veraCacheTtl,
    cache: veraCache
  });

  const namespace = request.directive.header.namespace || 'unknown';
  const directive = request.directive.header.name || 'unknown';
  utils.log('DEBUG', `${namespace}::${directive} Request: ${JSON.stringify(request)}`);

  let handler = null;

  if (namespace === 'Alexa.Discovery' && directive === 'Discover') {
    handler = discoveryHandler(vera, request, context, callback);

  } else if (namespace === 'Alexa' && directive === 'ReportState') {
    handler = reportStateHandler(vera, request, context, callback);

  } else if (namespace === 'Alexa.SceneController' && directive === 'Activate') {
    handler = sceneHandler(vera, request, context, callback);

  } else if (namespace === 'Alexa.PowerController' &&
    ['TurnOn', 'TurnOff'].indexOf(directive) !== -1) {
    handler = powerHandler(vera, request, context, callback);

  } else if (namespace === 'Alexa.PowerLevelController' &&
    ['SetPowerLevel', 'AdjustPowerLevel'].indexOf(directive) !== -1) {
    handler = powerLevelHandler(vera, request, context, callback);

  } else if (namespace === 'Alexa.LockController' &&
    ['Lock', 'Unlock'].indexOf(directive) !== -1) {
    handler = lockHandler(vera, request, context, callback);

  } else if (namespace === 'Alexa.ThermostatController' &&
    ['SetTargetTemperature', 'AdjustTargetTemperature', 'SetThermostatMode'].indexOf(directive) !== -1) {
    handler = thermostatHandler(vera, request, context, callback);

  } else {
    handler = Promise.reject(
      utils.error('INVALID_DIRECTIVE', `Unsupported namespace/directive: ${namespace}/${directive}`)
    );
  }

  handler
    .then((response) => callback(null, response))
    .catch((err) => {
      const correlationToken = request.directive.header.correlationToken;
      const endpointId = request.directive.endpoint && request.directive.endpoint.endpointId;
      callback(null, responses.createErrorResponse(err, correlationToken, endpointId));
    });
};
