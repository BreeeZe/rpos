import fs = require("fs");
import { Utils }  from './utils';
import { Server } from 'http';
import { RposConfig } from "./config";
import { NOT_AUTHORIZED } from "./faults";
var soap = <any>require('soap');

export interface TypeConstructor extends Function {
  name: string;
}

export type SoapServiceOptions = {
  path: string,
  services: any,
  xml: any,
  wsdlPath: string,
  onReady: () => void;
}
export class SoapService {
  webserver: Server;
  config: RposConfig;
  serviceInstance: any;
  serviceOptions: SoapServiceOptions;
  startedCallbacks: (() => void)[];
  isStarted: boolean;

  constructor(config: RposConfig, server: Server) {
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
    var onReady = this.serviceOptions.onReady;
    this.serviceOptions.onReady = () => {
      this._started();
      onReady();
    };
    this.serviceInstance = soap.listen(this.webserver, this.serviceOptions);

    this.serviceInstance.on("request", (request: any, methodName: string) => {
      Utils.log.debug('%s received request %s', (<TypeConstructor>this.constructor).name, methodName);

      // Use the '=>' notation so 'this' refers to the class we are in
      // ONVIF allows GetSystemDateAndTime to be sent with no authenticaton header
      // So we check the header and check authentication in this function

      // utils.log.info('received soap header');
      if (methodName === "GetSystemDateAndTime") return;

      if (this.config.Username) {
        let token: any = null;
        try {
          token = request.Header.Security.UsernameToken;
        } catch (err) {
          Utils.log.info('No Username/Password (ws-security) supplied for ' + methodName);
          throw NOT_AUTHORIZED;
        }
        var user = token.Username;
        var password = (token.Password.$value || token.Password);
        var nonce = (token.Nonce.$value || token.Nonce); // handle 2 ways to map XML to the javascript data structure
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

        var password_ok = (user === onvif_username && password === generated_password);

        if (password_ok == false) {
          Utils.log.info('Invalid username/password with ' + methodName);
          throw NOT_AUTHORIZED;
        }
      };
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