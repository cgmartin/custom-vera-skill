'use strict';
const utils = require('../lib/utils');
const config = require('../lib/config');
const res = require('../lib/responses');

module.exports = function discoveryHandler(vera) {
  vera.cache.clear(); // start fresh for discovery
  return vera.getControllers()
    .then((ctrls) => getAllControllerInfo(ctrls, vera))
    .then((results) => collectEndpoints(results))
    .then((endpoints) => res.createDiscoveryResponseObj(endpoints));
};

function getAllControllerInfo(ctrls, vera) {
  // Filter only certain controller devices
  if (config.veraControllerId) {
    const filterDevices = config.veraControllerId.split(',');
    ctrls = ctrls.filter((ctrl) => filterDevices.indexOf(ctrl.PK_Device) !== -1);
  }
  // Get device info and summary data for each device in parallel
  return Promise.all(ctrls.map((ctrl) => {
    return vera.getControllerInfo(ctrl)
      .then((cInfo) => Promise.all([vera.getUserData(cInfo), cInfo, ctrl]));
  }));
}

function collectEndpoints(results) {
  // Collect endpoints from all hub devices
  let endpoints = [];
  results.forEach(([udata, cInfo]) => {
    utils.log('DEBUG', `Vera UserData: ${cInfo.PK_Device}: # of devices = ${udata.devices.length}`);
    endpoints = endpoints.concat(processDevices(cInfo, udata), processScenes(cInfo, udata));
  });
  return endpoints;
}

function processScenes(cInfo, udata) {
  const endpoints = [];
  const includeScenes = getEnvDeviceList(config.veraScenesInclude);
  const excludeScenes = getEnvDeviceList(config.veraScenesExclude);
  udata.scenes.forEach((s) => {
    if (includeScenes) {
      if (includeScenes.indexOf(Number(s.id)) === -1) return;
    } else if (excludeScenes) {
      if (excludeScenes.indexOf(Number(s.id)) !== -1) return;
    }

    let endpoint = createSceneEndpoint(s, cInfo, udata);
    if (!endpoint) return;
    endpoints.push(endpoint);
  });
  return endpoints;
}

function processDevices(cInfo, udata) {
  const endpoints = [];
  const includeDevices = getEnvDeviceList(config.veraDevicesInclude);
  const excludeDevices = getEnvDeviceList(config.veraDevicesExclude);
  udata.devices.forEach((d) => {
    if (includeDevices) {
      if (includeDevices.indexOf(Number(d.id)) === -1) return;
    } else if (excludeDevices) {
      if (excludeDevices.indexOf(Number(d.id)) !== -1) return;
    }
    if (Number(d.invisible) === 1 || Number(d.disabled) === 1) {
      return;
    }

    let endpoint = createEndpointFromDevice(d, cInfo, udata);
    if (!endpoint) return;
    endpoints.push(endpoint);
  });
  return endpoints;
}

function getEnvDeviceList(envVar) {
  if (!envVar || envVar.trim().length === 0) return null;
  return envVar.split(',').map((id) => Number(id));
}

function createEndpointFromDevice(d, cInfo, udata) {
  const category = Number(d.category || d.category_num);
  switch (category) {
    case 2: return createDimmerEndpoint(d, cInfo, udata);
    case 3: return createSwitchEndpoint(d, cInfo, udata);
    case 5: return createThermostatEndpoint(d, cInfo, udata);
    //case 6: return createCameraEndpoint(d, cInfo, udata);
    case 7: return createLockEndpoint(d, cInfo, udata);
    case 17: return createTemperatureSensorEndpoint(d, cInfo, udata);
    default: return false;
  }
}

function createDimmerEndpoint(d, cInfo, udata) {
  const subcategory = Number(d.subcategory || d.subcategory_num);
  let displayCategory = 'OTHER';
  switch (subcategory) {
    case 0: displayCategory = 'LIGHT'; break;
    case 1: displayCategory = 'LIGHT'; break;
    case 2: displayCategory = 'SMARTPLUG'; break;
    case 3: displayCategory = 'SWITCH'; break;
    case 4: displayCategory = 'LIGHT'; break;
  }

  const endpoint = createStandardDeviceEndpointProps('Dimmable Light', displayCategory, d, cInfo, udata);
  endpoint.capabilities = [
    createDiscoveryCapability('Alexa'),
    createDiscoveryCapability('Alexa.EndpointHealth', ['connectivity']),
    createDiscoveryCapability('Alexa.PowerController', ['powerState']),
    createDiscoveryCapability('Alexa.PowerLevelController', ['powerLevel'])
    // createDiscoveryCapability('Alexa.BrightnessController', ['brightness'])
  ];

  // TODO: light with color
  // if (subcategory === 4) {
  //   endpoint.capabilities.push(createDiscoveryCapability('Alexa.ColorController', ['color']));
  // }

  return endpoint;
}

function createSwitchEndpoint(d, cInfo, udata) {
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

  const endpoint = createStandardDeviceEndpointProps('Switch', displayCategory, d, cInfo, udata);
  endpoint.capabilities = [
    createDiscoveryCapability('Alexa'),
    createDiscoveryCapability('Alexa.EndpointHealth', ['connectivity']),
    createDiscoveryCapability('Alexa.PowerController', ['powerState'])
  ];
  return endpoint;
}

function createThermostatEndpoint(d, cInfo, udata) {
  const endpoint = createStandardDeviceEndpointProps('Thermostat', 'THERMOSTAT', d, cInfo, udata);
  endpoint.capabilities = [
    createDiscoveryCapability('Alexa'),
    createDiscoveryCapability('Alexa.EndpointHealth', ['connectivity']),
    createDiscoveryCapability('Alexa.ThermostatController', ['targetSetpoint', 'thermostatMode']),
    createDiscoveryCapability('Alexa.TemperatureSensor', ['temperature'])
  ];
  return endpoint;
}

function createCameraEndpoint(d, cInfo, udata) {
  const endpoint = createStandardDeviceEndpointProps('Camera', 'CAMERA', d, cInfo, udata);
  endpoint.capabilities = [
    createDiscoveryCapability('Alexa'),
    createDiscoveryCapability('Alexa.EndpointHealth', ['connectivity']),
    createCameraStreamDiscoveryCapability(d)
  ];
  return endpoint;
}

function createLockEndpoint(d, cInfo, udata) {
  const endpoint = createStandardDeviceEndpointProps('Lock', 'SMARTLOCK', d, cInfo, udata);
  endpoint.capabilities = [
    createDiscoveryCapability('Alexa'),
    createDiscoveryCapability('Alexa.EndpointHealth', ['connectivity']),
    createDiscoveryCapability('Alexa.LockController', ['lockState'])
  ];
  return endpoint;
}

function createTemperatureSensorEndpoint(d, cInfo, udata) {
  const endpoint = createStandardDeviceEndpointProps('Temperature Sensor', 'TEMPERATURE_SENSOR', d, cInfo, udata);
  endpoint.capabilities = [
    createDiscoveryCapability('Alexa'),
    createDiscoveryCapability('Alexa.EndpointHealth', ['connectivity']),
    createDiscoveryCapability('Alexa.TemperatureSensor', ['temperature'])
  ];
  return endpoint;
}

function createStandardDeviceEndpointProps(categoryName, displayCategory, d, cInfo, udata) {
  const roomName = getRoomNameFromId(d.room, udata.rooms);
  const inRoom = (roomName) ? ` in ${roomName}` : '';
  return {
    endpointId: `${cInfo.PK_Device}-device-${d.id}`,
    manufacturerName: d.manufacturer || 'Vera',
    friendlyName: sanitizeFriendlyName(d.name),
    description: `${d.model || categoryName}${inRoom} connected via Vera`,
    displayCategories: [displayCategory],
    cookie: {
      room: roomName || 'none'
    }
  };
}

function createSceneEndpoint(s, cInfo, udata) {
  // TODO: Verify that the scene only contains allowed secure devices within it
  // https://developer.amazon.com/docs/smarthome/provide-scenes-in-a-smart-home-skill.html#allowed-devices
  const roomName = getRoomNameFromId(s.room, udata.rooms);
  const inRoom = (roomName) ? ` in ${roomName}` : '';
  const controllerCapability = createDiscoveryCapability('Alexa.SceneController');
  controllerCapability.supportsDeactivation = false;
  controllerCapability.proactivelyReported = false;

  return {
    endpointId: `${cInfo.PK_Device}-scene-${s.id}`,
    manufacturerName: 'Vera',
    friendlyName: sanitizeFriendlyName(s.name),
    description: `Scene${inRoom} connected via Vera`,
    displayCategories: ['SCENE_TRIGGER'],
    cookie: {
      room: roomName || 'none'
    },
    capabilities: [
      createDiscoveryCapability('Alexa'),
      createDiscoveryCapability('Alexa.EndpointHealth', ['connectivity']),
      controllerCapability
    ]
  };
}

function sanitizeFriendlyName(name) {
  return name.replace(/[-_]/g, ' ').replace(/[^a-zA-Z0-9 ]/g, '');
}

function createDiscoveryCapability(iface, supported) {
  const capability = {
    type: 'AlexaInterface',
    interface: iface,
    version: '3'
  };
  if (supported) {
    capability.properties = {
      supported: supported.map((s) => ({name: s})),
      retrievable: true,
      proactivelyReported: false
    };
  }
  return capability;
}

function createCameraStreamDiscoveryCapability(d) {
  const capability = {
    type: 'AlexaInterface',
    interface: 'Alexa.CameraStreamController',
    version: '3',
    cameraStreamConfigurations: []
  };
  // TODO: add configurations based on camera device.
  return capability;
}

function getRoomNameFromId(rId, rooms) {
  const room = rooms.find((r) => Number(r.id) === Number(rId));
  return (room) ? room['name'] : null;
}
