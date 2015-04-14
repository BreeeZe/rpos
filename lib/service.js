var fs = require("fs");
var soap = require('soap');
var http = require('http');
var url = require('url');
var utils = require('./utils');

function Service(config) {
  this.server = null;
  this.device_service = null;
  this.media_service = null;
  this.config = config;
  this.initialized = false;
}

Service.prototype.camera = null;

Service.prototype.initialize = function () {
  if (this.initialized)
    return;
  
  this.server = http.createServer(function (request, response) {
    utils.log.debug('web request received : %s', request.url);
    
    var request = url.parse(request.url, true);
    var action = request.pathname;
    if (action == '/web/snapshot.jpg') {
      try {
        var img = fs.readFileSync('/dev/shm/snapshot.jpg');
        response.writeHead(200, { 'Content-Type': 'image/jpg' });
        response.end(img, 'binary');
      } catch (err) {
        utils.log.error("Error opening snapshot : %s", err);
        response.end("404: Not Found: " + request);
      }
    } else {
      response.end("404: Not Found: " + request);
    }
  });
  this.initialized = true;
}

Service.prototype.start = function () {
  this.initialize();
  
  utils.log.info("Starting webserver on port: %s", this.config.ServicePort);
  this.server.listen(this.config.ServicePort);
  var ds = require('../services/device_service');
  
  var device_service_options = {
    path : '/onvif/device_service', 
    services : ds.service, 
    xml : fs.readFileSync('./wsdl/device_service.wsdl', 'utf8'),
    wsdlPath : 'wsdl/device_service.wsdl',
    onReady : function () {
      utils.log.info('device_service started');
    }
  };
  
  console.log("Binding device_service to '/onvif/device_service'");
  this.device_service = soap.listen(this.server, device_service_options);
  this.device_service.log = function (type, data) {
    utils.log.debug('device_service - Calltype : %s, Data : %s', type, data);
  };
  var ms = require('../services/media_service');
  var media_service_options = {
    path : '/onvif/media_service', 
    services : ms.service, 
    xml : fs.readFileSync('./wsdl/media_service.wsdl', 'utf8'),
    wsdlPath : 'wsdl/media_service.wsdl',
    onReady : function () {
      console.log('media_service started');
    }
  };
  
  utils.log.info("Binding media_service to '/onvif/media_service'");
  this.media_service = soap.listen(this.server, media_service_options);
  this.media_service.log = function (type, data) {
    utils.log.debug('media_service - Calltype : %s, Data : %s', type, data);
  };
  ms.camera = this.camera;
  this.camera.startAll();
}

module.exports = Service;