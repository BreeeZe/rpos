///<reference path="../typings/tsd.d.ts"/>
///<reference path="../typings/rpos/rpos.d.ts"/>
var utils_1 = require('./utils');
var soap = require('soap');
var utils = utils_1.Utils.utils;
var SoapService = (function () {
    function SoapService(config, server) {
        this.webserver = server;
        this.config = config;
        this.serviceInstance = null;
        this.startedCallbacks = [];
        this.isStarted = false;
        this.serviceOptions = {
            path: '',
            services: null,
            xml: null,
            wsdlPath: '',
            onReady: function () { }
        };
    }
    SoapService.prototype.starting = function () { };
    ;
    SoapService.prototype.started = function () { };
    ;
    SoapService.prototype.start = function () {
        var _this = this;
        this.starting();
        utils.log.info("Binding %s to http://%s:%s%s", this.constructor.name, utils.getIpAddress(), this.config.ServicePort, this.serviceOptions.path);
        this.webserver.listen(this.config.ServicePort);
        var onReady = this.serviceOptions.onReady;
        this.serviceOptions.onReady = function () {
            _this._started();
            onReady();
        };
        this.serviceInstance = soap.listen(this.webserver, this.serviceOptions);
        this.serviceInstance.on("request", function (request, methodName) {
            utils.log.debug('%s received request %s', _this.constructor.name, methodName);
        });
        this.serviceInstance.log = function (type, data) {
            if (_this.config.logSoapCalls)
                utils.log.debug('%s - Calltype : %s, Data : %s', _this.constructor.name, type, data);
        };
    };
    SoapService.prototype.onStarted = function (callback) {
        if (this.isStarted)
            callback();
        else
            this.startedCallbacks.push(callback);
    };
    ;
    SoapService.prototype._started = function () {
        this.isStarted = true;
        for (var _i = 0, _a = this.startedCallbacks; _i < _a.length; _i++) {
            var callback = _a[_i];
            callback();
        }
        this.startedCallbacks = [];
        this.started();
    };
    ;
    return SoapService;
})();
module.exports = SoapService;
//# sourceMappingURL=SoapService.js.map