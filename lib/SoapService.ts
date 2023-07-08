///<reference path="../rpos.d.ts"/>

import fs = require("fs");
import { Utils }  from './utils';
import { IncomingMessage, Server } from 'http';
var soap = <any>require('soap');
var utils = Utils.utils;

var NOT_AUTHORIZED = {
  Fault: {
    attributes: { // Add namespace here. Really wanted to put it in Envelope but this should be valid
      'xmlns:ter' : 'http://www.onvif.org/ver10/error',
    },
    Code: {
      Value: "soap:Sender",
      Subcode: {
        Value: "ter:NotAuthorized",  
      },
    },
    Reason: {
      Text: {
        attributes: {
          'xml:lang': 'en',
        },
        $value: 'Sender not Authorized',
      }
    }
  }
};


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
    var onReady = this.serviceOptions.onReady;
    this.serviceOptions.onReady = () => {
      this._started();
      onReady();
    };
    this.serviceInstance = soap.listen(this.webserver, this.serviceOptions);

    this.serviceInstance.on("request", (soapRequest: any, methodName: string, httpRequest: IncomingMessage) => {
      // Use the '=>' notation so 'this' refers to the class we are in

      utils.log.debug('%s received request %s', (<TypeConstructor>this.constructor).name, methodName);

      // EITHER RETURN (which means user authentication is OK) OR WE THOW IF THE AUTHENTICATION IS INVALID


      // If there is no username in the Configuration, we can return
      if (this.config.Username == null || this.config.Username == '') return;

      // ONVIF allows GetSystemDateAndTime to be sent with no authenticaton header
      if (methodName === "GetSystemDateAndTime") return;

      let token: any = null;
      try {
        token = soapRequest.Header.Security.UsernameToken;
      } catch (err) {
        token = null;
      }


      // If there is no HTTP Digest and no WS-Security Header (in the SOAP) return a 401 error
      if (httpRequest.headers['authorization'] == undefined && token == null) { // Allow Digest or WS-Security
      // if (httpRequest.headers['authorization'] == undefined) { // Digest only
        throw { "statusCode": 401,
                "httpHeader": {
                  "key": "WWW-Authenticate",
                  "value": `Digest realm="rpos-realm", qop="auth", algorithm="MD5", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093"`
                },
                "httpContents": "401 Digest Authentication Required"
              };
      };

      if (httpRequest.headers['authorization'] != undefined && httpRequest.headers['authorization'].startsWith("Digest")) {
        // Check Digest Authentication
        // Minimal checks currntly implemented
        let username = null;
        let realm = null;
        let uri = null;
        let nonce = null;
        let cnonce = null;
        let nc = null;
        let qop = null;
        let response = null;
        for (let item of httpRequest.headers['authorization'].substr(7).split(',')) { // trim "Digest "
          const keyValueSplit = item.split('=');
          if (keyValueSplit.length == 2) {
            const key = keyValueSplit[0].trim();
            let value = keyValueSplit[1].trim();
            if (value.startsWith('"')) value = value.substr(1,value.length-2); // remove quotes

            if (key == "username") username = value;
            else if (key == "realm") realm = value;
            else if (key == "uri") uri = value;
            else if (key == "nonce") nonce = value;
            else if (key == "cnonce") cnonce = value;
            else if (key == "nc") nc = value;
            else if (key == "qop") qop = value;
            else if (key == "response") response = value;
          }
        }
        let HA1 = utils.md5(username + ":" + realm + ":" + this.config.Password);
        let HA2 = utils.md5(httpRequest.method + ":" + uri);
        let computedResponse = null;
        if (qop == null || qop == '') {
            computedResponse = utils.md5(HA1 + ":" + nonce + ":" + HA2);
        } else if (qop == "auth")
        {
          computedResponse = utils.md5(HA1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + HA2);
        }

        if (response == computedResponse) {
          // Digest Authentication has passed
          return;
        }
      }

      // Fall through to checking WS-Security authentication
      if (token == null) {
          utils.log.info('No Username/Password (ws-security) supplied for ' + methodName);
          throw NOT_AUTHORIZED;
      } else {

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
          utils.log.info('Invalid username/password with ' + methodName);
          throw NOT_AUTHORIZED;
        }
      };
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
