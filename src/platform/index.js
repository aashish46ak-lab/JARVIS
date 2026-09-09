'use strict';

const os = require('os');

module.exports = {
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  platform: process.platform,
  homedir: os.homedir(),
};
