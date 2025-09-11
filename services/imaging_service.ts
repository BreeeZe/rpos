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

  imagingArray: ImagingArrayItem[] = [];

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

    // Add defailts for each Camera
    for (let i = 1; i <= config.Cameras.length; i++) {
      let newItem = {
        videoSourceToken: "video_src_token_" + i.toString().padStart(2,"0"),
        brightness: 50,  // range is 0..100
        autoFocusMode: "AUTO", // MANUAL or AUTO
        focusDefaultSpeed: 0.5, // range 0.1 to 1.0. See GetMoveOptions valid range
        focusNearLimit: 1.0,  // range 0.1 to 3.0 in Metres
        focusFarLimit: 0.0 // range 0.0 to 0.0.  0=Infinity
      };

      this.imagingArray.push(newItem);
    }

    this.extendService();
  }

  extendService() {
    var port = this.imaging_service.ImagingService.Imaging;

      

      //var GetServiceCapabilitiesResponse = {
        //Capabilities : {
          //attributes : {
            //ImageStabilization : {xs:boolean},
            //Presets : {xs:boolean}
          //}
        //}
      //
      //};

      port.GetServiceCapabilities = (args) => {
        var GetServiceCapabilitiesResponse = {
          Capabilities : {
            attributes : {
              ImageStabilization : false,
              Presets : false
            }
          }
        };
        return GetServiceCapabilitiesResponse;
      };

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
                Min : 0.1,
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

      const videoSourceToken = args.VideoSourceToken; // eg video_src_token_01

      let imageSettings = this.imagingArray.find(item => item.videoSourceToken == videoSourceToken);

      if (imageSettings == null || imageSettings == undefined) {
        throw ("Invalid Video Source Token");
      }
      
      let GetImagingSettingsResponse = {
        ImagingSettings : {
          Brightness : imageSettings.brightness,
          Focus : { 
            AutoFocusMode : imageSettings.autoFocusMode,
            DefaultSpeed : imageSettings.focusDefaultSpeed,
            NearLimit : imageSettings.focusNearLimit,
            FarLimit : imageSettings.focusFarLimit, // Infinity
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

        const videoSourceToken = args.VideoSourceToken; // eg video_src_token_01
        const camID = Number(videoSourceToken.substring(16));// Strip "video_src_token_" and we can use this to index into the config.Cameras Array
        const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

        let imageSettings = this.imagingArray.find(item => item.videoSourceToken == videoSourceToken);

        if (imageSettings == null || imageSettings == undefined) {
          throw ("Invalid Video Source Token");
        }

        let SetImagingSettingsResponse = { };

        // Check for Brightness value
        if (args.ImagingSettings) {
          if (args.ImagingSettings.Brightness) {
            imageSettings.brightness = args.ImagingSettings.Brightness;
            // emit the 'brightness' message to the parent
            if (this.callback) this.callback('brightness', {value: imageSettings.brightness, cameraAddress: cameraAddress});
          }
          if (args.ImagingSettings.Focus) {
            if (args.ImagingSettings.Focus.AutoFocusMode) {
              imageSettings.autoFocusMode = args.ImagingSettings.Focus.AutoFocusMode;
              if (this.callback) this.callback('focusmode', {value: imageSettings.autoFocusMode, cameraAddress: cameraAddress});
            }
            if (args.ImagingSettings.Focus.DefaultSpeed) {
              imageSettings.focusDefaultSpeed = args.ImagingSettings.Focus.DefaultSpeed;
              if (this.callback) this.callback('focusdefaultspeed', {value: imageSettings.focusDefaultSpeed, cameraAddress: cameraAddress});
            }
            if (args.ImagingSettings.Focus.NearLimit) {
              imageSettings.focusNearLimit = args.ImagingSettings.Focus.NearLimit;
              if (this.callback) this.callback('focusnearlimit', {value: imageSettings.focusNearLimit, cameraAddress: cameraAddress});
            }
            if (args.ImagingSettings.Focus.FarLimit) {
              imageSettings.focusFarLimit = args.ImagingSettings.Focus.FarLimit;
              if (this.callback) this.callback('focusfarlimit', {value: imageSettings.focusFarLimit, cameraAddress: cameraAddress});
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

        const videoSourceToken = args.VideoSourceToken; // eg video_src_token_01
        const camID = Number(videoSourceToken.substring(16));// Strip "video_src_token_" and we can use this to index into the config.Cameras Array
        const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

        let imageSettings = this.imagingArray.find(item => item.videoSourceToken == videoSourceToken);

        if (imageSettings == null || imageSettings == undefined) {
          throw ("Invalid Video Source Token");
        }

        var MoveResponse = { };

        if (args.Focus) {
          if (args.Focus.Continuous) {
            if (this.callback) this.callback('focus', {value: args.Focus.Continuous.Speed, cameraAddress: cameraAddress});
          }
        }

        return MoveResponse;
      };

      //var GetMoveOptions = {
        //VideoSourceToken : { xs:string}
      //
      //};
      port.GetMoveOptions = (args) => {
        var GetMoveOptionsResponse = {
          MoveOptions : {
            //Absolute : {
              //Position : {
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //Speed : {
                //Min : { xs:float},
                //Max : { xs:float}
              //}
            //},
            //Relative : {
              //Distance : {
                //Min : { xs:float},
                //Max : { xs:float}
              //},
              //Speed : {
                //Min : { xs:float},
                //Max : { xs:float}
              //}
            //},
            Continuous : {
              Speed : {
                Min : -1.0,
                Max : 1.0
              }
            }
          }
        };
        return GetMoveOptionsResponse;
      };

      //var Stop = { 
      //VideoSourceToken : { xs:string}
      //
      //};
      port.Stop = (args) => {

        const videoSourceToken = args.VideoSourceToken; // eg video_src_token_01
        const camID = Number(videoSourceToken.substring(16));// Strip "video_src_token_" and we can use this to index into the config.Cameras Array
        const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

        let imageSettings = this.imagingArray.find(item => item.videoSourceToken == videoSourceToken);

        if (imageSettings == null || imageSettings == undefined) {
          throw ("Invalid Video Source Token");
        }

        var StopResponse = { };

        if (this.callback) this.callback('focusstop', {cameraAddress: cameraAddress});

        return StopResponse;
      };

      //var GetStatus = {
        //VideoSourceToken : { xs:string}
      //
      //};
      port.GetStatus = (args) => {
        
        var GetStatusResponse = {
          Status : {
            FocusStatus20 : {
              Position : 5.0,     // Need to read current focus position
              MoveStatus : 'IDLE', // MOVING IDLE or UNKNOWN
              //Error : '',
              //Extension : { }
            },
            //Extension : { }
          }
        };
        return GetStatusResponse;
      };




  }
}
export = ImagingService;
