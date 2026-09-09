'use strict';

const si = require('systeminformation');

async function getSystemStatus() {
  try {
    const [load, mem, fsSize, battery] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.battery(),
    ]);
    const primary = (fsSize || []).sort((a, b) => b.size - a.size)[0];
    return {
      cpuLoadPercent: load?.currentLoad ?? null,
      ramUsedPercent: mem ? Math.round((mem.used / mem.total) * 100) : null,
      diskUsedPercent: primary ? primary.use : null,
      batteryPercent: battery?.hasBattery ? battery.percent : null,
    };
  } catch (err) {
    return { cpuLoadPercent: null, ramUsedPercent: null, diskUsedPercent: null, batteryPercent: null };
  }
}

module.exports = { getSystemStatus };
