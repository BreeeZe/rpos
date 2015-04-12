var os = require('os');
var clc = require('cli-color');

Date.prototype.stdTimezoneOffset = function () {
  var jan = new Date(this.getFullYear(), 0, 1);
  var jul = new Date(this.getFullYear(), 6, 1);
  return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

Date.prototype.dst = function () {
  return this.getTimezoneOffset() < this.stdTimezoneOffset();
};

var utils = {
  
  getSerial : function () {
    // Extract serial from cpuinfo file
    cpuserial = "0000000000000000"
    try {
      var f = require('child_process').execSync('sudo /proc/cpuinfo', 'r']);
      cpuserial = f.match(/Serial[ ]*: ([0-9a-f]{16})$/);
    } catch (ex) {
      this.log.error("Failed to read serial : %s", ex.message);
      cpuserial = "ERROR000000000";
    }
    return cpuserial
  },
  
  getIpAddress : function (interfaceName, type) {
    var address = null;
    type = type || "IPv4";
    var ni = os.networkInterfaces()[interfaceName] || [];
    for (var i = 0; i < ni.length ; i++) {
      var nif = ni[i];
      if (nif.family == type)
        address = nif.address;
    }
    return address;
  },
  
  log : {
    level : 0,
    error : function () {
      if (this.level > 0) {
        arguments[0] = clc.red(arguments[0]);
        console.log.apply(this, arguments);
      }
    },
    warn: function () {
      if (this.level > 1) {
        arguments[0] = clc.orange(arguments[0]);
        console.log.apply(this, arguments);
      }
    },
    info : function () {
      if (this.level > 2)
        console.log.apply(this, arguments);
    },
    debug : function () {
      if (this.level > 3) {
        arguments[0] = clc.green(arguments[0]);
        console.log.apply(this, arguments);
      }
    },
  }
};

module.exports = utils;