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

  brightness = 0;
  autoFocusMode = '';
  focusNearLimit = 0;
  focusFarLimit = 0;
  focusDefaultSpeed = 0;

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

    this.brightness = 50;  // range is 0..100
    this.autoFocusMode = "MANUAL"; // MANUAL or AUTO
    this.focusDefaultSpeed = 0.5; // range 0.0 to 1.0
    this.focusNearLimit = 1.0;  // range 0.1 to 3.0
    this.focusFarLimit = 0.0; // range 0.0 to 0.0

    this.extendService();
  }

  extendService() {
    var port = this.imaging_service.ImagingService.Imaging;


      //var GetOptions = { 
        //VideoSourceToken : { xs:string}
      //
      //};
      port.GetOptions = (args /*, cb, headers*/) => {
        var GetOptionsResponse = { 
          ImagingOptions : { 
            //BacklightCompensation : { 
              //Mode : { xs:string},
              //Level : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //}
            //},
            Brightness : { 
              Min : 0,
              Max : 100
            },
            //ColorSaturation : { 
              //Min : { xs:float},
              //Max : { xs:float}
            //},
            //Contrast : { 
              //Min : { xs:float},
              //Max : { xs:float}
            //},
            //Exposure : { 
              //Mode : { xs:string},
              //Priority : [{ xs:string}],
              //MinExposureTime : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //MaxExposureTime : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //MinGain : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //MaxGain : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //MinIris : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //MaxIris : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //ExposureTime : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //Gain : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //Iris : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //}
            //},
            Focus : { 
              AutoFocusModes : ['AUTO','MANUAL'],
              DefaultSpeed : { 
                Min : 0.0,
                Max : 1.0
              },
              NearLimit : { 
                Min : 0.1,
                Max : 3.0
              },
              FarLimit : { 
                Min : 0.0,
                Max : 0.0
              },
              //Extension : { }
            //},
            //IrCutFilterModes : [{ xs:string}],
            //Sharpness : { 
              //Min : { xs:float},
              //Max : { xs:float}
            //},
            //WideDynamicRange : { 
              //Mode : { xs:string},
              //Level : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //}
            //},
            //WhiteBalance : { 
              //Mode : { xs:string},
              //YrGain : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //YbGain : { 
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //Extension : { }
            //},
            //Extension : { 
              //ImageStabilization : { 
                //Mode : { xs:string},
                //Level : { 
                  //Min : { xs:float},
                  //Max : { xs:float}
                //},
                //Extension : { }
              //},
              //Extension : { 
                //IrCutFilterAutoAdjustment : { 
                  //BoundaryType : { xs:string},
                  //BoundaryOffset : { xs:boolean},
                  //ResponseTimeRange : { 
                    //Min : { xs:duration},
                    //Max : { xs:duration}
                  //},
                  //Extension : { }
                //},
                //Extension : { 
                  //ToneCompensationOptions : { 
                    //Mode : { xs:string},
                    //Level : { xs:boolean}
                  //},
                  //DefoggingOptions : { 
                    //Mode : { xs:string},
                    //Level : { xs:boolean}
                  //},
                  //NoiseReductionOptions : { 
                    //Level : { xs:boolean}
                  //},
                  //Extension : { }
                //}
              //}
            }
          }
        }
        return GetOptionsResponse;
      },



    port.GetImagingSettings = (args /*, cb, headers*/) => {
      var GetImagingSettingsResponse = {
        ImagingSettings : {
          Brightness : this.brightness,
          Focus : { 
            AutoFocusMode : this.autoFocusMode,
            DefaultSpeed : this.focusDefaultSpeed,
            NearLimit : this.focusNearLimit,
            FarLimit : this.focusFarLimit, // Infinity
            //Extension : { }
            },
        }
      };
      return GetImagingSettingsResponse;
    };

        //var SetImagingSettings = { 
        //VideoSourceToken : { xs:string},
        //ImagingSettings : { 
          //BacklightCompensation : { 
            //Mode : { xs:string},
            //Level : { xs:float}
          //},
          //Brightness : { xs:float},
          //ColorSaturation : { xs:float},
          //Contrast : { xs:float},
          //Exposure : { 
            //Mode : { xs:string},
            //Priority : { xs:string},
            //Window : { 
              //attributes : {
                //bottom : {xs:float},
                //top : {xs:float},
                //right : {xs:float},
                //left : {xs:float}
              //}
            //},
            //MinExposureTime : { xs:float},
            //MaxExposureTime : { xs:float},
            //MinGain : { xs:float},
            //MaxGain : { xs:float},
            //MinIris : { xs:float},
            //MaxIris : { xs:float},
            //ExposureTime : { xs:float},
            //Gain : { xs:float},
            //Iris : { xs:float}
          //},
          //Focus : { 
            //AutoFocusMode : { xs:string},
            //DefaultSpeed : { xs:float},
            //NearLimit : { xs:float},
            //FarLimit : { xs:float},
            //Extension : { }
          //},
          //IrCutFilter : { xs:string},
          //Sharpness : { xs:float},
          //WideDynamicRange : { 
            //Mode : { xs:string},
            //Level : { xs:float}
          //},
          //WhiteBalance : { 
            //Mode : { xs:string},
            //CrGain : { xs:float},
            //CbGain : { xs:float},
            //Extension : { }
          //},
          //Extension : { 
            //ImageStabilization : { 
              //Mode : { xs:string},
              //Level : { xs:float},
              //Extension : { }
            //},
            //Extension : { 
              //IrCutFilterAutoAdjustment : [{ 
                //BoundaryType : { xs:string},
                //BoundaryOffset : { xs:float},
                //ResponseTime : { xs:duration},
                //Extension : { }
              //}],
              //Extension : { 
                //ToneCompensation : { 
                  //Mode : { xs:string},
                  //Level : { xs:float},
                  //Extension : { }
                //},
                //Defogging : { 
                  //Mode : { xs:string},
                  //Level : { xs:float},
                  //Extension : { }
                //},
                //NoiseReduction : { 
                  //Level : { xs:float}
                //},
                //Extension : { }
              //}
            //}
          //}
        //},
        //ForcePersistence : [{ xs:boolean}]
      //
      //};

      port.SetImagingSettings = (args) => {
        var SetImagingSettingsResponse = { };

        // Check for Brightness value
        if (args.ImagingSettings) {
          if (args.ImagingSettings.Brightness) {
            this.brightness = args.ImagingSettings.Brightness;
            // emit the 'brightness' message to the parent
            if (this.callback) this.callback('brightness', {value: this.brightness});
          }
          if (args.ImagingSettings.Focus) {
            if (args.ImagingSettings.Focus.AutoFocusMode) {
              this.autoFocusMode = args.ImagingSettings.Focus.AutoFocusMode;
              if (this.callback) this.callback('focusmode', {value: this.autoFocusMode});
            }
            if (args.ImagingSettings.Focus.DefaultSpeed) {
              this.focusDefaultSpeed = args.ImagingSettings.Focus.DefaultSpeed;
              if (this.callback) this.callback('focusdefaultspeed', {value: this.focusDefaultSpeed});
            }
            if (args.ImagingSettings.Focus.NearLimit) {
              this.focusNearLimit = args.ImagingSettings.Focus.NearLimit;
              if (this.callback) this.callback('focusnearlimit', {value: this.focusNearLimit});
            }
            if (args.ImagingSettings.Focus.FarLimit) {
              this.focusFarLimit = args.ImagingSettings.Focus.FarLimit;
              if (this.callback) this.callback('focusfarlimit', {value: this.focusFarLimit});
            }
          }
        }

        return SetImagingSettingsResponse;
      };

        //var Move = { 
        //VideoSourceToken : { xs:string},
        //Focus : { 
          //Absolute : { 
            //Position : { xs:float},
            //Speed : { xs:float}
          //},
          //Relative : { 
            //Distance : { xs:float},
            //Speed : { xs:float}
          //},
          //Continuous : { 
            //Speed : { xs:float}
          //}
        //}
      //
      //};
      port.Move = (args) => {
        var MoveResponse = { };

        if (args.Focus) {
          if (args.Focus.Continuous) {
            if (this.callback) this.callback('focus', args.Focus.Continuous.Speed);
          }
        }

        return MoveResponse;
      };

      //var Stop = { 
      //VideoSourceToken : { xs:string}
      //
      //};
      port.Stop = (args) => {
        var StopResponse = { };

        if (this.callback) this.callback('focusstop', {});

        return StopResponse;
      };

  }
}
export = ImagingService;
