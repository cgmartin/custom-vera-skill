'use strict';
module.exports = {
  // Your Vera Username
  veraUserId: process.env['VERA_USER_ID'],

  // Your Vera Password (or use VERA_PASSWORD_HASH)
  veraPassword: process.env['VERA_PASSWORD'],

  // Pre-hashed Password: sha1(userId + password + salt)
  veraPasswordHash: process.env['VERA_PASSWORD_HASH'],

  // Specify specific Vera controllers to use (comma separated) [Default: uses all controllers in account]
  veraControllerId: process.env['VERA_CONTROLLER_ID'],

  // Scenes to include or exclude during device discovery
  veraScenesInclude: process.env['VERA_SCENES_INCLUDE'],
  veraScenesExclude: process.env['VERA_SCENES_EXCLUDE'],

  // Devices to include or exclude during device discovery
  veraDevicesInclude: process.env['VERA_DEVICES_INCLUDE'],
  veraDevicesExclude: process.env['VERA_DEVICES_EXCLUDE'],

  // S3 Cache settings
  veraCacheS3Bucket: process.env['VERA_CACHE_S3_BUCKET'],
  veraCacheS3Region: process.env['VERA_CACHE_S3_REGION'] || 'us-east-1',
  veraCacheS3Key: process.env['VERA_CACHE_S3_KEY'] || 'custom_vera_skill/vera_cache.json',
  veraCacheTtl: Number(process.env['VERA_CACHE_TTL'])
};
