'use strict';
const utils = require('../lib/utils');
const res = require('../lib/responses');

module.exports = function reportStateHandler(vera, request) {
  const correlationToken = request.directive.header.correlationToken;
  const endpointId = request.directive.endpoint.endpointId;
  const [ctrlId, endpointType, dId] = endpointId.split('-');

  // Retrieve the device/scene info from vera
  return vera.getSummaryDataById(ctrlId)
    .then(([sData, cInfo]) => reportState(dId, sData, endpointType, cInfo, vera))
    .then((props) => res.createResponseObj(props, endpointId, correlationToken, 'Alexa', 'StateReport'));
};

function reportState(dId, sData, endpointType, cInfo, vera) {
  // device or scene state?
  if (endpointType === 'device') {
    return utils.findDeviceInSummaryData(dId, sData)
      .then((d) => Promise.all([d, vera.getDeviceStatus(cInfo, dId)]))
      .then(([d, dStatus]) => createDeviceStateContextProps(d, dStatus, sData));
  }

  if (endpointType === 'scene') {
    return utils.findSceneInSummaryData(dId, sData)
      .then((s) => Promise.all([s, vera.listScene(cInfo, dId)]))
      .then(([s, sList]) => Promise.all([s, sList, checkSceneSecureDevices(sList)]))
      .then(() => createSceneStateContextProps());
  }

  return Promise.reject(utils.error('NO_SUCH_ENDPOINT', `Unknown endpoint type: ${endpointType}`));
}

function createDeviceStateContextProps(d, dStatus, sData) {
  switch (d['category']) {
    case 2: return createDimmerContextProps(d, dStatus);
    case 3: return createSwitchContextProps(d);
    case 5: return createThermostatContextProps(d, sData);
    //case 6: return createCameraContextProps(d);
    case 7: return createLockContextProps(d);
    case 17: return createTemperatureSensorContextProps(d, sData);
    default: return [];
  }
}

function createDimmerContextProps(d, dStatus) {
  const deviceStates = (dStatus[`Device_Num_${d.id}`]) ? dStatus[`Device_Num_${d.id}`].states : [];
  const displayCategory = utils.getDimmerDisplayCategory(d, deviceStates);

  const properties = [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.PowerController', 'powerState', Number(d.status) === 1 ? 'ON' : 'OFF')
  ];

  // Smart Home API recommends you should implement the most specific interface possible
  if (displayCategory === 'LIGHT') {
    properties.push(res.createContextProperty('Alexa.BrightnessController', 'brightness', Number(d.level)));
  } else {
    properties.push(res.createContextProperty('Alexa.PowerLevelController', 'powerLevel', Number(d.level)));
  }

  // Light with color
  if (Number(d.subcategory) === 4) {
    const sColors = utils.extractRGBColors(deviceStates);
    if ('R' in sColors && 'G' in sColors && 'B' in sColors) {
      const hsb = utils.convertRgbToHsv(sColors.R, sColors.G, sColors.B);
      properties.push(res.createContextProperty('Alexa.ColorController', 'color', hsb));
    }
    if ('W' in sColors && 'D' in sColors) {
      const kelvin = utils.convertWarmColdValuesToKelvin(sColors.W, sColors.D);
      properties.push(
        res.createContextProperty('Alexa.ColorTemperatureController', 'colorTemperatureInKelvin', kelvin)
      );
    }
  }

  return properties;
}

function createSwitchContextProps(d) {
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.PowerController', 'powerState', Number(d.status) === 1 ? 'ON' : 'OFF')
  ];
}

function createThermostatContextProps(d, sData) {
  const tempScale = utils.tstatScaleVeraToAlexa(sData.temperature);
  const targetSetpoint = {value: Number(d.setpoint), scale: tempScale};
  const temperature = {value: Number(d.temperature), scale: tempScale};
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.ThermostatController', 'targetSetpoint', targetSetpoint),
    res.createContextProperty('Alexa.ThermostatController', 'thermostatMode', utils.tstatModeVeraToAlexa(d.mode)),
    res.createContextProperty('Alexa.TemperatureSensor', 'temperature', temperature)
  ];
}

function createLockContextProps(d) {
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.LockController', 'lockState', Number(d.locked) ? 'LOCKED' : 'UNLOCKED')
  ];
}

function createTemperatureSensorContextProps(d, sData) {
  const temperature = {value: Number(d.temperature), scale: utils.tstatScaleVeraToAlexa(sData.temperature)};
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'}),
    res.createContextProperty('Alexa.TemperatureSensor', 'temperature', temperature)
  ];
}

function checkSceneSecureDevices(sList) {
  if (utils.sceneHasForbiddenDevices(sList.groups)) {
    return Promise.reject(utils.error('NO_SUCH_ENDPOINT', 'Scene contains insecure devices'));
  }
  return true;
}

function createSceneStateContextProps() {
  return [
    res.createContextProperty('Alexa.EndpointHealth', 'connectivity', {value: 'OK'})
  ];
}
