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
 * Returns a number whose value is limited to a given range
 * @param {Number} num
 * @param {Number} min
 * @param {Number} max
 */
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/**
 * Clamp to closest number
 * @param {Number} num
 * @param {array} steps numbers to clamp to
 */
function closestNumber(num, steps) {
  let closest = steps[0];
  steps.forEach((s) => {
    if (Math.abs(num - s) < Math.abs(num - closest)) {
      closest = s;
    }
  });
  return closest;
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

function convertKelvinToWarmColdValues(kelvin) {
  kelvin = clamp(Number(kelvin), 2000, 9000);
  let warm = 0;
  let cold = 0;
  if (kelvin < 5500) { // warm: 2000 - 5500
    warm = 255 - Math.round(255 * (kelvin - 2000) / (5500 - 2000));
  } else if (kelvin > 5500) { // cold: 5500 - 9000
    cold = Math.round(255 * (kelvin - 5500) / (9000 - 5500));
  }
  return [warm, cold, kelvin];
}

function convertWarmColdValuesToKelvin(warm, cold) {
  let kelvin = 5500;
  if (warm > 0) {
    kelvin = 2000 + (((255 - warm) / 255) * (5500 - 2000));
  } else if (cold > 0) {
    kelvin = 5500 + ((cold / 255) * (9000 - 5500));
  }
  return kelvin;
}

function extractRGBColors(states) {
  const colorServiceUrn = 'urn:micasaverde-com:serviceId:Color1';
  const supColorsState = states.find((s) => s.service === colorServiceUrn && s.variable === 'SupportedColors');
  const curColorsState = states.find((s) => s.service === colorServiceUrn && s.variable === 'CurrentColor');
  if (!supColorsState || !curColorsState) return null;

  const colors = {};
  const colorKeys = supColorsState.value.split(/,/);
  curColorsState.value.split(/,/).forEach((color) => {
    let [ci, cv] = color.split(/=/);
    colors[colorKeys[Number(ci)]] = Number(cv);
  });
  return colors;
}

function convertRgbToHsv(r, g, b) {
  // Based on https://gist.github.com/mjackson/5311256
  r /= 255;
  g /= 255;
  b /= 255;

  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let d = max - min;

  let h = 0;
  let s = (max === 0) ? 0 : d / max;
  let v = max;

  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d) + (g < b ? 6 : 0); break;
      case g: h = ((b - r) / d) + 2; break;
      case b: h = ((r - g) / d) + 4; break;
    }
    h /= 6;
  }

  return {
    hue: 360 * h,
    saturation: s,
    brightness: v
  };
}

function convertHsvToRgb(h, s, v) {
  h /= 360;
  let r, g, b;

  let i = Math.floor(h * 6);
  let f = (h * 6) - i;
  let p = v * (1 - s);
  let q = v * (1 - (f * s));
  let t = v * (1 - ((1 - f) * s));

  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }

  return {
    r: Math.max(Math.min(r * 256, 255), 0),
    g: Math.max(Math.min(g * 256, 255), 0),
    b: Math.max(Math.min(b * 256, 255), 0)
  };
}

function getSwitchDisplayCategory(d, states) {
  const subcategory = Number(d.subcategory || d.subcategory_num);
  let displayCategory = 'OTHER';
  switch (subcategory) {
    case 0: displayCategory = 'LIGHT'; break;
    case 1: displayCategory = 'SWITCH'; break;
    case 2: displayCategory = 'SWITCH'; break;
    case 3: displayCategory = 'SMARTPLUG'; break;
    case 5: displayCategory = 'SWITCH'; break;
    case 6: displayCategory = 'SWITCH'; break;
  }
  return getDisplayCategoryOverride(states, displayCategory);
}

function getDimmerDisplayCategory(d, states) {
  const subcategory = Number(d.subcategory || d.subcategory_num);
  let displayCategory = 'OTHER';
  switch (subcategory) {
    case 0: displayCategory = 'LIGHT'; break;
    case 1: displayCategory = 'LIGHT'; break;
    case 2: displayCategory = 'SMARTPLUG'; break;
    case 3: displayCategory = 'SWITCH'; break;
    case 4: displayCategory = 'LIGHT'; break;
  }
  return getDisplayCategoryOverride(states, displayCategory);
}

function getDisplayCategoryOverride(states, defaultCategory) {
  if (!states) return defaultCategory;
  const override = states.find((s) =>
    (s.service === 'urn:cgmartin-com:serviceId:SmartHomeSkill1' && s.variable === 'DisplayCategory')
  );
  return (override) ? override.value : defaultCategory;
}

function getRoomNameFromId(rId, rooms) {
  const room = rooms.find((r) => Number(r.id) === Number(rId));
  return (room) ? room.name : null;
}

function sceneHasForbiddenDevices(groups) {
  return groups.find((g) => g.actions.find(
    (a) => a.service.includes(':DoorLock') || a.service.includes(':Camera') || a.service.includes(':SecuritySensor')
  ));
}

module.exports = {
  log,
  uuid,
  clamp,
  closestNumber,
  error,
  isEndpointTypeValid,
  findDeviceInSummaryData,
  findSceneInSummaryData,
  tstatScaleVeraToAlexa,
  tstatScaleAlexaToVera,
  tstatModeVeraToAlexa,
  tstatModeAlexaToVera,
  convertTemperature,
  convertTemperatureDelta,
  convertKelvinToWarmColdValues,
  convertWarmColdValuesToKelvin,
  extractRGBColors,
  convertRgbToHsv,
  convertHsvToRgb,
  getSwitchDisplayCategory,
  getDimmerDisplayCategory,
  getDisplayCategoryOverride,
  getRoomNameFromId,
  sceneHasForbiddenDevices
};
