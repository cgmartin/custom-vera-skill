'use strict';
const https = require('https');

/**
 * Send an HTTPS request and receive a response
 */
module.exports = function request(opts, queryParams) {
  return new Promise((resolve, reject) => {
    if (queryParams) {
      opts.path += '?' + Object.keys(queryParams)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
        .join('&');
    }
    opts.agent = new https.Agent({keepAlive: true});

    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', (d) => {
        body += d;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Unsuccessful request [${res.statusCode}]`));
        return (opts.json) ? resolve(JSON.parse(body)) : resolve(body);
      });
      res.on('error', (err) => {
        return reject(err);
      });
    });
    req.on('error', (err) => {
      return reject(err);
    });
    req.end();
  });
};
