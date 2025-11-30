///<reference path="../rpos.d.ts"/>

import fs = require("fs");
import { Utils }  from './utils';
import { Server } from 'http';
import crypto = require('crypto');
var soap = <any>require('soap');
var utils = Utils.utils;

var NOT_IMPLEMENTED = {
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
  lastValidAuthAt: number;
  recentAuthWindowMs: number;

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

    this.lastValidAuthAt = 0;
    this.recentAuthWindowMs = 5 * 60 * 1000; // 5 minutes

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

    this.serviceInstance.on("request", (request: any, methodName: string) => {
      utils.log.debug('%s received request %s', (<TypeConstructor>this.constructor).name, methodName);

      // Use the '=>' notation so 'this' refers to the class we are in
      // ONVIF allows GetSystemDateAndTime to be sent with no authenticaton header
      // So we check the header and check authentication in this function

      // utils.log.info('received soap header');
      if (methodName === "GetSystemDateAndTime") return;

      if (this.config.Username) {
        const token = request?.Header?.Security?.UsernameToken;
        if (!token) {
          utils.log.info('No Username/Password (ws-security) supplied for ' + methodName, {
            header: request?.Header,
          });
          throw NOT_IMPLEMENTED;
        }

        if (!this.validateUsernameToken(token)) {
          utils.log.info('Invalid username/password with ' + methodName);
          throw NOT_IMPLEMENTED;
        }
      }
    });

    this.serviceInstance.log = (type: string, data: any) => {
      if (this.config.logSoapCalls)
        utils.log.debug('%s - Calltype : %s, Data : %s', (<TypeConstructor>this.constructor).name, type, data);
    };
  }

  extractUsernameToken(request: any): { token: any, debug: any } {
    const first = (value: any) => Array.isArray(value) ? value[0] : value;
    const firstDefined = (...values: any[]) => values.find((v) => v !== undefined && v !== null);

    const header = firstDefined(first(request?.Header), first(request?.header));
    const securityFromHeader = firstDefined(first(header?.Security), first(header?.security));

    const token = first(
      firstDefined(
        first(securityFromHeader?.UsernameToken),
        first(firstDefined(first(request?.Security), first(request?.security))?.UsernameToken),
        first(header?.UsernameToken),
        first(request?.UsernameToken),
        first(request?.usernameToken)
      )
    );

    const headerCandidates = {
      Header: header,
      Security: securityFromHeader,
      rootSecurity: firstDefined(first(request?.Security), first(request?.security)),
    };

    const debug = {
      requestKeys: request ? Object.keys(request) : undefined,
      headerKeys: Object.entries(headerCandidates).reduce((acc: any, [key, value]) => {
        if (value) acc[key] = Object.keys(value);
        return acc;
      }, {}),
    };

    return { token, debug };
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

  validateUsernameToken(token: any): boolean {
    const authDebugEnabled = this.config.AuthDebug === true;
    const logAuthDebug = (message: string, data?: any) => {
      if (authDebugEnabled) {
        utils.log.info(message, data);
      }
    };
    const logAuthOutcome = (result: boolean) => {
      if (utils.log.level >= Utils.logLevel.Debug) {
        utils.log.debug(`Auth received: ${result ? 'Pass' : 'Fail'}`);
      }
    };

    const username = token?.Username?.$value ?? token?.Username ?? '';
    const passwordElement = token?.Password;
    const password = passwordElement?.$value ?? passwordElement ?? '';
    const passwordType = passwordElement?.attributes?.Type ?? passwordElement?.Type ?? '';
    const nonce = token?.Nonce?.$value ?? token?.Nonce ?? '';
    const created = token?.Created?.$value ?? token?.Created ?? '';

    const onvif_username = this.config.Username;
    const onvif_password = this.config.Password;

    logAuthDebug('[AuthDebug] Parsed UsernameToken', {
      username,
      passwordType: passwordType || 'PasswordDigest',
      nonce,
      created,
    });

    if (!username || !password || !onvif_username) {
      logAuthDebug('[AuthDebug] Missing credential fields', {
        hasUsername: !!username,
        hasPassword: !!password,
        hasConfiguredUsername: !!onvif_username,
        hasNonce: !!nonce,
        hasCreated: !!created,
      });
      logAuthOutcome(false);
      return false;
    }

    const isPasswordText = typeof passwordType === 'string' && passwordType.indexOf('PasswordText') !== -1;

    if (isPasswordText) {
      const isMatch = username === onvif_username && password === onvif_password;
      logAuthDebug('[AuthDebug] PasswordText comparison', {
        providedUsername: username,
        expectedUsername: onvif_username,
        providedPassword: password,
        expectedPassword: onvif_password,
        result: isMatch,
      });
      logAuthOutcome(isMatch);
      return isMatch;
    }

    const rawNonce = Buffer.from(nonce || '', 'base64');
    const combined_data = Buffer.concat([
      rawNonce,
      Buffer.from(created || '', 'ascii'),
      Buffer.from(onvif_password || '', 'ascii')
    ]);

    const pwHash = crypto.createHash('sha1');
    pwHash.update(combined_data);
    const generated_password = pwHash.digest('base64');

    const isDigestMatch = username === onvif_username && password === generated_password;
    logAuthDebug('[AuthDebug] PasswordDigest comparison', {
      providedUsername: username,
      expectedUsername: onvif_username,
      providedPasswordDigest: password,
      generatedPasswordDigest: generated_password,
      rawNonce: nonce,
      created,
      result: isDigestMatch,
    });

    logAuthOutcome(isDigestMatch);
    return isDigestMatch;
  }
}
export = SoapService;
