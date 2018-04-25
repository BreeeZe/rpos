///<reference path="../typings/main.d.ts" />
///<reference path="../rpos.d.ts" />

import fs = require("fs");
import util = require("util");
import os = require('os');
import SoapService = require('../lib/SoapService');
import { Utils }  from '../lib/utils';
import { Server } from 'http';

var utils = Utils.utils;

class ImagingService extends SoapService {
  imaging_service: any;
  callback: any;

  presetArray = [];

  constructor(config: rposConfig, server: Server, callback) {
    super(config, server);

    this.imaging_service = require('./stubs/imaging_service.js').ImagingService;
    this.callback = callback;

    this.serviceOptions = {
      path: '/onvif/imaging_service',
      services: this.imaging_service,
      xml: fs.readFileSync('./wsdl/imaging_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/imaging_service.wsdl',
      onReady: () => console.log('imaging_service started')
    };

    this.extendService();
  }

  extendService() {
    var port = this.imaging_service.ImagingService.Imaging;

    port.GetImagingSettings = (args /*, cb, headers*/) => {
      var GetImagingSettingsResponse = {
        ImagingSettings : {
          Brightness : 128,
        }
      };
      return GetImagingSettingsResponse;
    };

  }
}
export = ImagingService;
