///<reference path="../typings/tsd.d.ts"/>
///<reference path="../typings/rpos/rpos.d.ts"/>

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

  constructor(config:rposConfig, server:Server) {
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

  starting() { };

  started() { };

  start() {
    this.starting();

    utils.log.info("Starting webserver on port: %s", this.config.ServicePort);
    this.webserver.listen(this.config.ServicePort);

    utils.log.info("Binding %s to %s", (<TypeConstructor>this.constructor).name, this.serviceOptions.path);
    var onReady = this.serviceOptions.onReady;
    this.serviceOptions.onReady = () => {
      this._started();
      onReady();
    };
    this.serviceInstance = soap.listen(this.webserver, this.serviceOptions);


    this.serviceInstance.on("request", (request:any, methodName:string) => {
      utils.log.debug('%s received request %s', (<TypeConstructor>this.constructor).name, methodName);
    });

    this.serviceInstance.log = (type:string, data:any) => {
      if (this.config.logSoapCalls)
        utils.log.debug('%s - Calltype : %s, Data : %s', (<TypeConstructor>this.constructor).name, type, data);
    };
  }

  onStarted(callback:()=>{}) {
    if (this.isStarted)
      callback();
    else
      this.startedCallbacks.push(callback);
  };

  _started() {
    this.isStarted = true;
    for (var callback of this.startedCallbacks)
      callback();
    this.startedCallbacks = [];
    this.started();
  };
}
export = SoapService;