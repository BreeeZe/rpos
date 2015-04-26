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

var property = function (value, options) {
  this.typeConstructor = value.constructor;
  this.dirty = false;
  this._value = value === undefined ? null : value;
  this.options = options || {};
  this.options.stringify = this.options.stringify || function (val) { return val.toString(); };
  
  Object.defineProperty(this, "value", {
    get: this.get,
    set: this.set
  });
};

property.prototype.get = function () {
  return this._value;
};

property.prototype.set = function (value) {
  if (this.typeConstructor) {
    if (this.typeConstructor.name == "Boolean") {
      value = value.toUpperCase() === "TRUE" ? true : value.toUpperCase() === "FALSE" ? false : value == 1;
    } else if (this.typeConstructor.name != "Object")
      value = this.typeConstructor(value);
  } else {
    this.typeConstructor = value.constructor;
  }
  if (value !== null && value !== undefined) {
    if (this.options.range && (value < this.options.range.min || value > this.options.range.max))
      throw ["value ", value, " not in range ", this.options.range.min, " - ", this.options.range.max].join('');
    if (this.options.set && this.options.set.indexOf(value) == -1)
      throw ["value ", value, " not in set ", this.options.set.join()].join('');
  }
  
  if (value !== this._value)
    this.dirty = true;
  this._value = value;
};

property.prototype.type = function () {
  return this.typeConstructor.name;
}

property.prototype.hasSet = function () {
  return (this.options.set || []).length > 0;
};

property.prototype.getSet = function () {
  var result = [];
  if (this.hasSet()) {
    for (var i = 0; i < this.options.set.length; i++) {
      result.push({ value: this.options.set[i], lookup : this.options.lookup[i] });
    }
  }
  return result;
};

property.prototype.hasRange = function () {
  return this.options.range;
};

property.prototype.isDirty = function () {
  return this.dirty;
};

property.prototype.reset = function () {
  this.dirty = false;
};

property.prototype.toString = function () {
  return this.options.stringify(this._value);
};

var utils = {
  
  property : property,
  
  getSerial : function () {
    // Extract serial from cpuinfo file
    cpuserial = "0000000000000000"
    try {
      var f = utils.execSync('sudo cat /proc/cpuinfo').toString();
      cpuserial = f.match(/Serial[\t]*: ([0-9a-f]{16})/)[1];
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
  isWin : function () {
    return /^win/.test(process.platform);
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
        arguments[0] = clc.yellow(arguments[0]);
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
  },
  execSync : function execSync(cmd) {
    var res = utils.isWin() ? ["execSync('", cmd, "')"].join('') : require('child_process').execSync(cmd);
    utils.log.debug(res);
    return res;
  },
  spawn : function (cmd, args, options) {
    utils.log.debug(["spawn('", cmd, "',[", (args || []).join(', '), "],[", (options || []).join(', '), "])"].join(''));
    if (utils.isWin()) {
      return {
        kill: function () { },
        on : function () { },
        stdout : { on : function () { } },
        stderr : { on : function () { } },
        stdin : { on : function () { } }
      };
    }
    else {
      return require('child_process').spawn(cmd, args, options);
    }
  },
  cleanup : function (callback) {
    
    // attach user callback to the process event emitter
    // if no callback, it will still exit gracefully on Ctrl-C
    callback = callback || function () { };
    process.on('cleanup', callback);
    
    // do app specific cleaning before exiting
    process.on('exit', function () {
      process.emit('cleanup');
    });
    
    // catch ctrl+c event and exit normally
    process.on('SIGINT', function () {
      console.log('Ctrl-C...');
      process.exit(2);
    });
    
    //catch uncaught exceptions, trace, then exit normally
    process.on('uncaughtException', function (e) {
      console.log('Uncaught Exception...');
      console.log(e.stack);
      process.exit(99);
    });
  }
};

module.exports = utils;