'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function colorTemperatureHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const directive = request.directive.header.name || 'unknown';
  const payload = request.directive.payload;
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device info from vera
  return utils.isEndpointTypeValid(endpointId, endpointType, 'device')
    .then(() => vera.getSummaryDataById(ctrlId))
    .then(([sData, cInfo]) => Promise.all([utils.findDeviceInSummaryData(dId, sData), sData, cInfo]))
    .then(([d, sData, cInfo]) => changeColorTemperature(d, sData, cInfo, directive, payload, vera))
    .then((props) => res.createResponseObj(props, endpointId, correlationToken));
};

function changeColorTemperature(d, sData, cInfo, directive, payload, vera) {
  // Verify that the device is capable of power on/off actions
  if (Number(d.category) !== 2 || Number(d.subcategory) !== 4) {
    return Promise.reject(utils.error('INVALID_VALUE', `Directive is not supported for this device: ${d.id}`));
  }

  // Set or Adjust
  let action = null;
  if (directive === 'SetColorTemperature') {
    action = setColorTemperature(d.id, cInfo, payload.colorTemperatureInKelvin, vera);
  } else if (directive === 'DecreaseColorTemperature' || directive === 'IncreaseColorTemperature') {
    const direction = (directive === 'DecreaseColorTemperature') ? -1 : 1;
    action = adjustColorTemperature(d.id, cInfo, direction, vera);
  } else {
    return Promise.reject(utils.error('INVALID_DIRECTIVE', `Unsupported directive: ${directive}`));
  }

  // Adjust power, and get new status
  return action
    .then((level) => {
      return [
        res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
        res.createContextProperty('Alexa.ColorTemperatureController', 'colorTemperatureInKelvin', Number(level), 1000)
      ];
    });
}

function setColorTemperature(dId, cInfo, colorTemperatureInKelvin, vera) {
  const [warm, cold, kelvin] = utils.convertKelvinToWarmColdValues(colorTemperatureInKelvin);
  return vera.setColorTemperature(cInfo, dId, cold, warm)
    .then(() => kelvin);
}

function adjustColorTemperature(dId, cInfo, direction, vera) {
  // https://developer.amazon.com/docs/device-apis/alexa-colortemperaturecontroller.html#setcolortemperature
  const kelvinLevels = [2000, 3000, 4000, 5000, 5500, 6000, 7000, 8000, 9000];
  return getRGBColors(dId, cInfo, vera)
    .then((colors) => {
      const currentKelvin = utils.convertWarmColdValuesToKelvin(colors.W, colors.D);
      const closest = utils.closestNumber(currentKelvin, kelvinLevels);
      const nextStep = utils.clamp(kelvinLevels.indexOf(closest) + direction, 0, kelvinLevels.length - 1);
      return setColorTemperature(dId, cInfo, kelvinLevels[nextStep], vera);
    });
}

function getRGBColors(dId, cInfo, vera) {
  return vera.getDeviceStatus(cInfo, dId)
    .then((dStatus) => {
      if (!dStatus[`Device_Num_${dId}`]) return Promise.reject(utils.error('INTERNAL_ERROR', 'Missing device status'));
      return utils.extractRGBColors(dStatus[`Device_Num_${dId}`].states);
    });
}
