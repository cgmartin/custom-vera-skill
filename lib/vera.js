'use strict';
const request = require('./request');
const crypto = require('crypto');

const VERA_AUTH_HOST = 'vera-us-oem-autha.mios.com';
const VERA_AUTH_SEED = 'oZ7QE6LcLJp6fiWzdqZc';

/**
 * Default in-memory cache for Vera Requests.
 * Can be swapped out for persistent cache implementations.
 */
class InMemoryVeraCache {
  constructor(opts = {}) {
    this.ttl = opts.ttl || 23.5 * 60 * 60 * 1000; // 23.5 hours in ms
    this.data = {};
  }

  getValue(key) {
    const valueObj = this.data[key];
    if (!valueObj) return Promise.resolve(null);
    if (valueObj.created + (valueObj.ttl || this.ttl) < Date.now()) {
      delete this.data[key];
      return Promise.resolve(null);
    }
    return Promise.resolve(valueObj.value);
  }

  setValue(key, value, ttl = null) {
    this.data[key] = {
      created: Date.now(),
      value
    };
    if (ttl) this.data[key].ttl = ttl;
    return Promise.resolve(value);
  }

  clear() {
    this.data = {};
  }
}

/**
 * Service class for interacting with Vera controllers
 * See also: http://wiki.micasaverde.com/index.php/Luup_Requests
 */
class Vera {
  constructor(opts = {}) {
    this.userId = opts.userId;
    this.password = opts.password;
    this.passwordHash = opts.passwordHash;
    this.auth = null;
    this.cache = opts.cache || new InMemoryVeraCache(opts);
  }

  /**
   * Authenticate with Vera servers.
   */
  authenticate() {
    return this.cache.getValue('auth')
      .then((cachedValue) => {
        if (cachedValue) return Promise.resolve(cachedValue);

        if (!this.passwordHash) {
          const shasum = crypto.createHash('sha1');
          shasum.update(`${this.userId}${this.password}${VERA_AUTH_SEED}`);
          this.passwordHash = shasum.digest('hex');
        }

        console.log(`[DEBUG] Vera Request: authenticate(${VERA_AUTH_HOST})`);
        return request({
          method: 'GET',
          host: VERA_AUTH_HOST,
          path: `/autha/auth/username/${this.userId}`,
          json: true
        }, {
          'SHA1Password': this.passwordHash,
          'PK_Oem': 1
        }).then((data) => {
          // Decode the identity information before returning
          data.IdentityData = JSON.parse(Buffer.from(data.Identity, 'base64').toString());
          return this.cache.setValue('auth', data, 3300000); // 55 mins
        });
      });
  }

  /**
   * Return a Session Token for a Vera Server
   */
  getSessionToken(server) {
    // Return cached session if hit
    return this.cache.getValue(`server|${server}`)
      .then((cachedValue) => {
        if (cachedValue) return Promise.resolve(cachedValue);

        console.log(`[DEBUG] Vera Request: getSession(${server})`);
        return this.authenticate()
          .then((auth) => {
            return request({
              method: 'GET',
              host: server,
              path: '/info/session/token',
              headers: {
                'MMSAuth': auth.Identity,
                'MMSAuthSig': auth.IdentitySignature
              },
              json: false
            });
          })
          .then((sessionToken) => this.cache.setValue(`server|${server}`, sessionToken));
      });
  }

  /**
   * Gets a list of Vera devices registered to the account
   */
  getControllers() {
    let server = null;
    let accountId = null;

    return this.cache.getValue('controllers')
      .then((cachedValue) => {
        if (cachedValue) return Promise.resolve(cachedValue);

        return this.authenticate()
          .then((auth) => {
            server = auth.Server_Account;
            accountId = auth.IdentityData.PK_Account;
            return this.getSessionToken(server);
          })
          .then((sessionToken) => {
            console.log(`[DEBUG] Vera Request: getControllers(${server})`);
            return request({
              method: 'GET',
              host: server,
              path: `/account/account/account/${accountId}/devices`,
              headers: {
                'MMSSession': sessionToken
              },
              json: true
            }).then((data) => data.Devices);
          })
          .then((ctrls) => this.cache.setValue('controllers', ctrls));
      });
  }

  /**
   * Gets detailed info for a controller (ie. internalIP, externalIP, Firmware, etc.)
   * @param {object} ctrl an object returned from `getControllers()` array
   */
  getControllerInfo(ctrl) {
    const ctrlId = ctrl.PK_Device;
    const server = ctrl.Server_Device;
    return this.getSessionToken(server)
      .then((sessionToken) => {
        console.log(`[DEBUG] Vera Request: getControllerInfo(${server}) ${ctrlId}`);
        return request({
          method: 'GET',
          host: server,
          path: `/device/device/device/${ctrlId}`,
          headers: {
            'MMSSession': sessionToken
          },
          json: true
        });
      });
  }

  /**
   * Retrieve the Summary Data using just the controller ID
   * @param {string} ctrlId Vera Controller ID
   */
  getSummaryDataById(ctrlId) {
    // PERFORMANCE OPTIMIZATION: Skip relayServer lookup requests using cache
    return this.getControllers()
      .then((ctrls) => {
        const ctrl = ctrls.find((c) => c.PK_Device === ctrlId);
        if (!ctrl) {
          return Promise.reject(error('NO_SUCH_ENDPOINT', `The main hub device was not found: ${ctrlId}`));
        }
        return this.getControllerInfo(ctrl)
          .then((cInfo) => Promise.all([this.getSummaryData(cInfo), cInfo, ctrl]));
      });
  }

  /**
   * Sends a generic data request to a controller
   */
  dataRequest(cInfo, queryParams, json = true) {
    let relayServer = cInfo.Server_Relay;
    let ctrlId = cInfo.PK_Device;
    return this.getSessionToken(relayServer)
      .then((sessionToken) => {
        console.log(`[DEBUG] Vera Request: getDataRequest(${relayServer}) ${JSON.stringify(queryParams)}`);
        return request({
          method: 'GET',
          host: relayServer,
          path: `/relay/relay/relay/device/${ctrlId}/port_3480/data_request`,
          headers: {
            'MMSSession': sessionToken
          },
          json
        }, queryParams);
      });
  }

  /**
   * Gets all config data of all rooms, child devices, scenes, etc from an account device
   */
  getUserData(cInfo) {
    return this.dataRequest(cInfo, {
      'id': 'user_data'
    });
  }

  /**
   * Gets a smaller status report of all rooms, child devices, scenes, etc from an account device
   */
  getSummaryData(cInfo) {
    return this.dataRequest(cInfo, {
      'id': 'sdata'
    });
  }

  getDeviceStatus(cInfo, dId) {
    return this.dataRequest(cInfo, {
      'id': 'status',
      'DeviceNum': dId,
      'output_format': 'json'
    });
  }

  isDeviceAlive(cInfo) {
    return this.dataRequest(cInfo, {
      'id': 'alive'
    }, false);
  }

  setSwitchState(cInfo, switchId, state) {
    return this.dataRequest(cInfo, {
      'id': 'action',
      'DeviceNum': switchId,
      'serviceId': 'urn:upnp-org:serviceId:SwitchPower1',
      'action': 'SetTarget',
      'newTargetValue': state,
      'output_format': 'json'
    });
  }

  turnSwitchOn(cInfo, switchId) {
    return this.setSwitchState(cInfo, switchId, 1);
  }

  turnSwitchOff(cInfo, switchId) {
    return this.setSwitchState(cInfo, switchId, 0);
  }

  getSwitchState(cInfo, switchId) {
    return this.dataRequest(cInfo, {
      'id': 'variableget',
      'DeviceNum': switchId,
      'serviceId': 'urn:upnp-org:serviceId:SwitchPower1',
      'Variable': 'Status',
      'output_format': 'json'
    });
  }

  dimLight(cInfo, lightId, percentage) {
    if (percentage > 100) percentage = 100;
    if (percentage < 0) percentage = 0;
    return this.dataRequest(cInfo, {
      'id': 'action',
      'DeviceNum': lightId,
      'serviceId': 'urn:upnp-org:serviceId:Dimming1',
      'action': 'SetLoadLevelTarget',
      'newLoadlevelTarget': percentage,
      'output_format': 'json'
    });
  }

  getDimLevel(cInfo, lightId) {
    return this.dataRequest(cInfo, {
      'id': 'variableget',
      'DeviceNum': lightId,
      'serviceId': 'urn:upnp-org:serviceId:Dimming1',
      'Variable': 'LoadLevelTarget',
      'output_format': 'json'
    });
  }

  getCurrentTemperature(cInfo, thermId) {
    return this.dataRequest(cInfo, {
      'id': 'variableget',
      'DeviceNum': thermId,
      'serviceId': 'urn:upnp-org:serviceId:TemperatureSetpoint1',
      'Variable': 'CurrentSetpoint',
      'output_format': 'json'
    });
  }

  getTargetTemperature(cInfo, thermId) {
    return this.dataRequest(cInfo, {
      'id': 'variableget',
      'DeviceNum': thermId,
      'serviceId': 'urn:upnp-org:serviceId:TemperatureSetpoint1',
      'Variable': 'SetpointTarget',
      'output_format': 'json'
    });
  }

  setTargetTemperature(cInfo, thermId, temp) {
    return this.dataRequest(cInfo, {
      'id': 'action',
      'DeviceNum': thermId,
      'serviceId': 'urn:upnp-org:serviceId:TemperatureSetpoint1',
      'action': 'SetCurrentSetpoint',
      'NewCurrentSetpoint': temp,
      'output_format': 'json'
    });
  }

  getThermostatMode(cInfo, thermId) {
    // CoolOn, HeatOn, AutoChangeOver, Off
    return this.dataRequest(cInfo, {
      'id': 'variableget',
      'DeviceNum': thermId,
      'serviceId': 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1',
      'Variable': 'ModeStatus',
      'output_format': 'json'
    });
  }

  setThermostatMode(cInfo, thermId, mode) {
    // CoolOn, HeatOn, AutoChangeOver, Off
    return this.dataRequest(cInfo, {
      'id': 'action',
      'DeviceNum': thermId,
      'serviceId': 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1',
      'action': 'SetModeTarget',
      'NewModeTarget': mode,
      'output_format': 'json'
    });
  }

  setRGBColor(cInfo, lightId, r, g, b) {
    return this.dataRequest(cInfo, {
      'id': 'lu_action',
      'DeviceNum': lightId,
      'serviceId': 'urn:micasaverde-com:serviceId:Color1',
      'action': 'SetColorRGB',
      'newColorRGBTarget': `${r},${g},${b}`,
      'output_format': 'json'
    });
  }

  setColorTemperature(cInfo, lightId, coldValue, warmValue) {
    return this.dataRequest(cInfo, {
      'id': 'lu_action',
      'DeviceNum': lightId,
      'serviceId': 'urn:micasaverde-com:serviceId:Color1',
      'action': 'SetColorTemp',
      'newColorTempTarget': `${coldValue},${warmValue}`,
      'output_format': 'json'
    });
  }

  getLockState(cInfo, lockId) {
    return this.dataRequest(cInfo, {
      'id': 'variableget',
      'DeviceNum': lockId,
      'serviceId': 'urn:micasaverde-com:serviceId:DoorLock1',
      'Variable': 'Status',
      'output_format': 'json'
    });
  }

  setLockState(cInfo, lockId, state) {
    return this.dataRequest(cInfo, {
      'id': 'action',
      'DeviceNum': lockId,
      'serviceId': 'urn:micasaverde-com:serviceId:DoorLock1',
      'action': 'SetTarget',
      'newTargetValue': state,
      'output_format': 'json'
    });
  }

  listScene(cInfo, sId) {
    return this.dataRequest(cInfo, {
      'id': 'scene',
      'action': 'list',
      'scene': sId,
      'output_format': 'json'
    });
  }

  runScene(cInfo, sceneId) {
    return this.dataRequest(cInfo, {
      'id': 'action',
      'serviceId': 'urn:micasaverde-com:serviceId:HomeAutomationGateway1',
      'action': 'RunScene',
      'SceneNum': sceneId,
      'output_format': 'json'
    });
  }

  stopScene(cInfo, sceneId) {
    return this.dataRequest(cInfo, {
      'id': 'action',
      'serviceId': 'urn:micasaverde-com:serviceId:HomeAutomationGateway1',
      'action': 'SceneOff',
      'SceneNum': sceneId,
      'output_format': 'json'
    });
  }
}

Vera.InMemoryVeraCache = InMemoryVeraCache;

module.exports = Vera;

function error(type, message) {
  const err = new Error(message);
  err.type = type;
  return err;
}


