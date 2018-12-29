///<reference path="../typings/main.d.ts"/>
///<reference path="../rpos.d.ts"/>

import fs = require("fs");
import { Utils }  from './utils';
import { Server } from 'http';
var soap = <any>require('soap');
var utils = Utils.utils;

class SoapService {
  webserver: Server;
  config: rposConfig;
  serviceInstance: any;
  serviceOptions: SoapServiceOptions;
  startedCallbacks: (() => void)[];
  isStarted: boolean;

  constructor(config: rposConfig, server: Server) {
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
      onReady: () => { }
    };

  }

  starting() { }

  started() { }

  start() {
    this.starting();

    utils.log.info("Binding %s to http://%s:%s%s", (<TypeConstructor>this.constructor).name, utils.getIpAddress(), this.config.ServicePort, this.serviceOptions.path);
    this.webserver.listen(this.config.ServicePort);
    var onReady = this.serviceOptions.onReady;
    this.serviceOptions.onReady = () => {
      this._started();
      onReady();
    };
    this.serviceInstance = soap.listen(this.webserver, this.serviceOptions);
    if (this.config.Username) {
      this.serviceInstance.authenticate = (security) => {
        var token = security.UsernameToken;
        var user = token.Username;
        var password = token.Password.$value;
        var nonce = token.Nonce.$value;
        var created = token.Created;

        var onvif_username = this.config.Username;
        var onvif_password = this.config.Password;

        // digest = base64 ( sha1 ( nonce + created + onvif_password ) )
        var crypto = require('crypto');
        var pwHash = crypto.createHash('sha1');
        var rawNonce = new Buffer(nonce || '', 'base64')
        var combined_data = Buffer.concat([rawNonce,
          Buffer.from(created, 'ascii'), Buffer.from(onvif_password, 'ascii')]);
        pwHash.update(combined_data);
        var generated_password = pwHash.digest('base64');

        return (user === onvif_username && password === generated_password);
      };
    }

    this.serviceInstance.on("request", (request: any, methodName: string) => {
      utils.log.debug('%s received request %s', (<TypeConstructor>this.constructor).name, methodName);
    });

    this.serviceInstance.log = (type: string, data: any) => {
      if (this.config.logSoapCalls)
        utils.log.debug('%s - Calltype : %s, Data : %s', (<TypeConstructor>this.constructor).name, type, data);
    };
  }

  onStarted(callback: () => {}) {
    if (this.isStarted)
      callback();
    else
      this.startedCallbacks.push(callback);
  }

  _started() {
    this.isStarted = true;
    for (var callback of this.startedCallbacks)
      callback();
    this.startedCallbacks = [];
    this.started();
  }
}
export = SoapService;