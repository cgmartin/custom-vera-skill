'use strict';
const AWS = require('aws-sdk');
const Vera = require('./vera');

/**
 * Persistent S3-backed Cache for the Vera class utility
 */
class S3VeraCache extends Vera.InMemoryVeraCache {
  constructor(opts = {}) {
    super(opts);
    this.s3Bucket = opts.s3Bucket;
    this.s3Key = opts.s3Key;
    this.s3 = new AWS.S3({
      region: opts.s3Region,
      apiVersion: '2006-03-01'
    });
    this.data = null;
  }

  getValue(key) {
    return this.loadData()
      .then(() => super.getValue(key));
  }

  setValue(key, value, ttl) {
    return super.setValue(key, value, ttl)
      .then(() => this.saveData(value));
  }

  loadData() {
    if (this.data) return Promise.resolve(this.data);

    const s3Params = {
      Bucket: this.s3Bucket,
      Key: this.s3Key,
      ResponseContentType: 'application/json'
    };
    return this.s3.getObject(s3Params).promise()
      .then((data) => JSON.parse(data.Body.toString()))
      .catch((err) => {
        console.log('[WARNING] S3VeraCache getObject failed: ' + err.message);
        return {}; // start fresh session first time, does not exist, or any other error
      })
      .then((data) => {
        console.log('[DEBUG] S3VeraCache loaded');
        this.data = data;
        return this.data;
      });
  }

  saveData(value) {
    const s3Params = {
      Bucket: this.s3Bucket,
      Key: this.s3Key,
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
      Body: Buffer.from(JSON.stringify(this.data))
    };
    return this.s3.putObject(s3Params).promise()
      .then(() => {
        console.log('[DEBUG] S3VeraCache putObject success');
        return value;
      })
      .catch((err) => {
        console.log(`[WARNING] S3VeraCache putObject failed: ${err.message}`);
        return value; // continue without interruption
      });
  }
}

module.exports = S3VeraCache;
