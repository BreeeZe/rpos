///<reference path="../typings/main.d.ts"/>
///<reference path="../rpos.d.ts"/>

import * as fs from "fs";
import { Utils }  from './utils';
import { Server } from 'http';

var soap = <any>require('soap');

export class SoapService {
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

    Utils.log.info("Binding %s to http://%s:%s%s", (<TypeConstructor>this.constructor).name, Utils.getIpAddress(), this.config.ServicePort, this.serviceOptions.path);
    this.webserver.listen(this.config.ServicePort);
    var onReady = this.serviceOptions.onReady;
    this.serviceOptions.onReady = () => {
      this._started();
      onReady();
    };
    this.serviceInstance = soap.listen(this.webserver, this.serviceOptions);


    this.serviceInstance.on("request", (request: any, methodName: string) => {
      Utils.log.debug('%s received request %s', (<TypeConstructor>this.constructor).name, methodName);
    });

    this.serviceInstance.log = (type: string, data: any) => {
      if (this.config.logSoapCalls)
        Utils.log.debug('%s - Calltype : %s, Data : %s', (<TypeConstructor>this.constructor).name, type, data);
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