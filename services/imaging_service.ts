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
                Min : 1.0,
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
          Brightness : 50,
          Focus : { 
            AutoFocusMode : 'AUTO',
            DefaultSpeed : 1.0,
            NearLimit : 1.0,
            FarLimit : 0.0, // Inifinit
            //Extension : { }
            },
        }
      };
      return GetImagingSettingsResponse;
    };

  }
}
export = ImagingService;
