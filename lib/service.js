var fs = require("fs");
var soap = require('soap');
var utils = require('./utils');

function Service(config, server) {
  var $this = this;
  this.webserver = server;
  this.config = config;
  this.serviceInstance = null;
  this.serviceOptions = {
    path : '', 
    services : null, 
    xml : null,
    wsdlPath : '',
    onReady : function () {
    }
  };
  this.startedCallbacks = [];
  this.isStarted = false;
}

Service.prototype.starting = function () { };

Service.prototype.started = function () { };

Service.prototype.start = function () {
  var $this = this;
  
  this.starting();
  
  utils.log.info("Starting webserver on port: %s", this.config.ServicePort);
  this.webserver.listen(this.config.ServicePort);
  
  utils.log.info("Binding %s to %s", $this.constructor.name, this.serviceOptions.path);
  var onReady = this.serviceOptions.onReady;
  this.serviceOptions.onReady = function () {
    $this._started();
    onReady();
  };
  this.service = soap.listen(this.webserver, this.serviceOptions);
  
  
  this.service.on("request", function (request, methodName) {
    utils.log.debug('%s received request %s', $this.constructor.name, methodName);
  });
  
  this.service.log = function (type, data) {
    if ($this.config.logSoapCalls)
      utils.log.debug('%s - Calltype : %s, Data : %s', $this.constructor.name, type, data);
  };
}

Service.prototype.onStarted = function (callback) {
  if (this.isStarted)
    callback();
  else
    this.startedCallbacks.push(callback);
};

Service.prototype._started = function () {
  this.isStarted = true;
  for (var c = 0; c < this.startedCallbacks.length ; c++)
    this.startedCallbacks[c]();
  this.startedCallbacks = [];
  this.started();
};
module.exports = Service;