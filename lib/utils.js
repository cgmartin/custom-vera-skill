'use strict';
/**
 * Utility Functions
 */

/**
 * Standard log format
 */
function log(title, msg) {
  console.log(`[${title}] ${msg}`);
}

/**
 * Generate a UUID
 * https://gist.github.com/jed/982883 DWTFYW public license
 */
function uuid(fmt) {
  return fmt ? (fmt ^ (Math.random() * 16 >> fmt / 4)).toString(16)
    : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, uuid);
}

/**
 * Standard error format
 */
function error(type, message, validRange) {
  const err = new Error(message);
  err.type = type;
  err.validRange = validRange;
  return err;
}

/**
 * Validate that the endpoint type is a match
 */
function isEndpointTypeValid(endpointId, type) {
  const [_hubId, endpointType] = endpointId.split('-');
  return (endpointType === type)
    ? Promise.resolve()
    : Promise.reject(error('NO_SUCH_ENDPOINT', `Invalid endpoint for this directive: ${endpointId}`));
}

/**
 * Find the device info within the Summary Data
 * @param {string} dId device ID
 * @param {object} sData summary data
 */
function findDeviceInSummaryData(dId, sData) {
  const d = sData.devices.find((device) => (Number(device.id) === Number(dId)));
  return (d)
    ? Promise.resolve(d)
    : Promise.reject(error('NO_SUCH_ENDPOINT', `Missing endpoint device: ${dId}`));
}

/**
 * Find the scene info within the Summary Data
 * @param {string} sId scene ID
 * @param {object} sData summary data
 */
function findSceneInSummaryData(sId, sData) {
  const s = sData.scenes.find((scene) => (Number(scene.id) === Number(sId)));
  return (s)
    ? Promise.resolve(s)
    : Promise.reject(error('NO_SUCH_ENDPOINT', `Missing endpoint scene: ${sId}`));
}

/**
 * Convert a temperature scale id from Vera to Alexa
 */
function tstatScaleVeraToAlexa(scale) {
  switch (scale) {
    case 'F': return 'FAHRENHEIT';
    case 'C': return 'CELSIUS';
    case 'K': return 'KELVIN';
    default: return 'UNKNOWN';
  }
}

/**
 * Convert a temperature scale id from Alexa to Vera
 */
function tstatScaleAlexaToVera(scale) {
  return scale[0];
}

/**
 * Convert a thermostat mode id from Vera to Alexa
 */
function tstatModeVeraToAlexa(mode) {
  switch (mode) {
    case 'AutoChangeOver': return 'AUTO';
    case 'CoolOn': return 'COOL';
    case 'HeatOn': return 'HEAT';
    case 'Off': return 'OFF';
    default: return 'UNKNOWN';
  }
}

/**
 * Convert a thermostat mode id from Alexa to Vera
 */
function tstatModeAlexaToVera(mode) {
  switch (mode) {
    case 'AUTO': return 'AutoChangeOver';
    case 'COOL': return 'CoolOn';
    case 'HEAT': return 'HeatOn';
    case 'OFF': return 'Off';
    default: return 'Unknown';
  }
}

/**
 * Convert temperature between different scales
 */
function convertTemperature(temp, fromScale, toScale) {
  if (fromScale === toScale) {
    return temp;
  } else if (fromScale === 'C' && toScale === 'F') {
    return (temp * 1.8) + 32;
  } else if (fromScale === 'F' && toScale === 'C') {
    return (temp - 32) / 1.8;
  } else if (fromScale === 'K' && toScale === 'F') {
    return (temp * 1.8) - 459.67;
  } else if (fromScale === 'F' && toScale === 'K') {
    return (temp + 459.67) / 1.8;
  } else if (fromScale === 'K' && toScale === 'C') {
    return temp - 273.15;
  } else if (fromScale === 'C' && toScale === 'K') {
    return temp + 273.15;
  }
}

/**
 * Convert a temperature delta interval between different scales
 */
function convertTemperatureDelta(delta, fromScale, toScale) {
  if (fromScale === toScale) {
    return delta;
  } else if ((fromScale === 'C' && toScale === 'F') || (fromScale === 'K' && toScale === 'F')) {
    return delta * 1.8;
  } else if ((fromScale === 'F' && toScale === 'C') || (fromScale === 'F' && toScale === 'K')) {
    return delta / 1.8;
  } else if ((fromScale === 'K' && toScale === 'C') || (fromScale === 'C' && toScale === 'K')) {
    return delta;
  }
}

module.exports = {
  log,
  uuid,
  error,
  isEndpointTypeValid,
  findDeviceInSummaryData,
  findSceneInSummaryData,
  tstatScaleVeraToAlexa,
  tstatScaleAlexaToVera,
  tstatModeVeraToAlexa,
  tstatModeAlexaToVera,
  convertTemperature,
  convertTemperatureDelta
};
