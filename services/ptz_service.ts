///<reference path="../typings/main.d.ts" />
///<reference path="../rpos.d.ts" />

import fs = require("fs");
import util = require("util");
import os = require('os');
import SoapService = require('../lib/SoapService');
import { Utils }  from '../lib/utils';
import { Server } from 'http';

var utils = Utils.utils;

class PTZService extends SoapService {
  ptz_service: any;
  callback: any;
  ptz_driver: any;

  presetArray = [];

  constructor(config: rposConfig, server: Server, callback, ptz_driver) {
    super(config, server);

    this.ptz_service = require('./stubs/ptz_service.js').PTZService;
    this.callback = callback;
    this.ptz_driver = ptz_driver;

    this.serviceOptions = {
      path: '/onvif/ptz_service',
      services: this.ptz_service,
      xml: fs.readFileSync('./wsdl/ptz_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/ptz_service.wsdl',
      onReady: () => console.log('ptz_service started')
    };

    for (var i = 1; i <=  255; i++) {
      this.presetArray.push({profileToken: 'token', presetName: '', presetToken: i.toString(), used: false});
    }

    this.extendService();
  }




  extendService() {
    var port = this.ptz_service.PTZService.PTZ;

    // ptzConfigurations is an Array.
    var ptzConfigurationOptions = {
      Spaces: {},
      PTZTimeout : { 
        Min : 'PT0S',
        Max : 'PT10S'
      },
    };

    if (this.ptz_driver.supportsAbsolutePTZ) {
      ptzConfigurationOptions.Spaces['AbsolutePanTiltPositionSpace'] = [{
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/PositionGenericSpace',
          XRange : { 
              Min : -1.0,
              Max : 1.0
          },
          YRange : { 
              Min : -1.0,
              Max : 1.0
          }
        }];
    }
    if (this.ptz_driver.supportsRelativePTZ) {
      ptzConfigurationOptions.Spaces['RelativePanTiltTranslationSpace'] = [{
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/TranslationGenericSpace',
          XRange : { 
              Min : -1.0,
              Max : 1.0
          },
          YRange : { 
              Min : -1.0,
              Max : 1.0
          }
        }];
    }
    if (this.ptz_driver.supportsContinuousPTZ) {
      ptzConfigurationOptions.Spaces['ContinuousPanTiltVelocitySpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace',
          XRange : { 
            Min : -1,
            Max : 1
          },
          YRange : { 
            Min : -1,
            Max : 1
          }
        }];
       ptzConfigurationOptions.Spaces['ContinuousZoomVelocitySpace'] =  [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
          XRange : { 
            Min : -1,
            Max : 1
          }
        }];
    }
    if (this.ptz_driver.supportsRelativePTZ || this.ptz_driver.supportsAbsolutePTZ) {
      ptzConfigurationOptions.Spaces['PanTiltSpeedSpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/GenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }];
        ptzConfigurationOptions.Spaces['ZoomSpeedSpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/ZoomGenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }];
    }

    port.GetServiceCapabilities = (args) => {
      var GetServiceCapabilitiesResponse = { 
        Capabilities : { 
          attributes : {
            EFlip : false,
            Reverse : false,
            GetCompatibleConfigurations : false,
            MoveStatus : false,
            StatusPosition : false
          }
        }
      };
      return GetServiceCapabilitiesResponse;
    };

    port.GetConfigurationOptions = (args) => {
      // ToDo. Check token and return a valid response or an error reponse
      var GetConfigurationOptionsResponse = { PTZConfigurationOptions: ptzConfigurationOptions };
      return GetConfigurationOptionsResponse;
    };

    var ptzConfiguration = {
      attributes: {
        token: "ptz_config_token_0"
      },
      Name: "PTZ Configuration",
      UseCount: 1,
      NodeToken: "ptz_node_token_0",
      DefaultAbsolutePantTiltPositionSpace : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/PositionGenericSpace',
      DefaultRelativePanTiltTranslationSpace : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/TranslationGenericSpace',
      DefaultContinuousPanTiltVelocitySpace : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace',
      DefaultContinuousZoomVelocitySpace : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
      DefaultPTZSpeed : { 
        PanTilt : { 
          attributes : {
            x : 1.0,
            y : 1.0,
            space : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/GenericSpeedSpace'
          }
        },
        Zoom : { 
          attributes : {
            x : 1,
            space : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/ZoomGenericSpeedSpace'
          }
        }
      },
      DefaultPTZTimeout : 'PT5S'
    }
        
    port.GetConfiguration = (args) => {
      // ToDo. Check token and return a valid response or an error reponse
      var GetConfigurationResponse = { PTZConfiguration: ptzConfiguration };
      return GetConfigurationResponse;
    };
	
    port.GetConfigurations = (args) => {
      var GetConfigurationsResponse = { PTZConfiguration: ptzConfiguration };
      return GetConfigurationsResponse;
    };

//    port.GetCompatibleConfigurations = (args) => {
//      var GetCompatibleConfigurationsResponse = { };
//      return GetCompatibleConfigurationsResponse;
//    };


    var node = { 
      attributes : {
        token : 'ptz_node_token_0',
      },
      Name : 'PTZ Node 0',
      SupportedPTZSpaces : { 
        AbsolutePanTiltPositionSpace : [{
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/PositionGenericSpace',
          XRange : { 
            Min : -1.0,
            Max : 1.0
          },
          YRange : { 
            Min : -1.0,
            Max : 1.0
          }
        }],
        RelativePanTiltTranslationSpace : [{
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/TranslationGenericSpace',
          XRange : { 
            Min : -1.0,
            Max : 1.0
          },
          YRange : { 
            Min : -1.0,
            Max : 1.0
          }
        }],
        ContinuousPanTiltVelocitySpace : [{ 
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace',
          XRange : { 
            Min : -1.0,
            Max : 1.0
          },
          YRange : { 
            Min : -1.0,
            Max : 1.0
          }
        }],
        ContinuousZoomVelocitySpace : [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
          XRange : { 
            Min : -1.0,
            Max : 1.0
          }
        }],
        PanTiltSpeedSpace : [{ 
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/GenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }],
        ZoomSpeedSpace : [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/ZoomGenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }],

      },
      MaximumNumberOfPresets : 255,
      HomeSupported : true,
      AuxiliaryCommands : ['AUX1on','AUX1off','AUX2on','AUX2off',
      'AUX3on','AUX3off','AUX4on','AUX4off',
      'AUX5on','AUX5off','AUX6on','AUX6off',
      'AUX7on','AUX7off','AUX8on','AUX8off']
    }

    port.GetNode = (args) => {
	  // ToDo. Check token and return a valid response or an error reponse
      var GetNodeResponse = { PTZNode: node };
      return GetNodeResponse;
    };

    port.GetNodes = (args) => {
      var GetNodesResponse = { PTZNode: node };
      return GetNodesResponse;
    };

    port.SetHomePosition = (args) => {
      if (this.callback) this.callback('sethome', {});
      var SetHomePositionResponse = { };
      return SetHomePositionResponse;
    };

    port.GotoHomePosition = (args) => {
      if (this.callback) this.callback('gotohome', {});
      var GotoHomePositionResponse = { };
      return GotoHomePositionResponse;
    };

    var pan = 0;
    var tilt = 0;
    var zoom = 0;
    var timeout = '';

    port.ContinuousMove = (args) =>  {
      // Update values or keep last known value
      try {pan = args.Velocity.PanTilt.attributes.x} catch (err){}; 
      try {tilt = args.Velocity.PanTilt.attributes.y} catch (err){}; 
      try {zoom = args.Velocity.Zoom.attributes.x} catch (err){}; 
      try {timeout = args.Timeout} catch (err){}; 
      if (this.callback) this.callback('ptz', { pan: pan, tilt: tilt, zoom: zoom});
      var ContinuousMoveResponse = { };
      return ContinuousMoveResponse;
    };

    port.AbsoluteMove = (args) =>  {
      // Update values or keep last known value
      try {pan = args.Position.PanTilt.attributes.x} catch (err){}; 
      try {tilt = args.Position.PanTilt.attributes.y} catch (err){}; 
      try {zoom = args.Position.Zoom.attributes.x} catch (err){}; 
      if (this.callback) this.callback('absolute-ptz', { pan: pan, tilt: tilt, zoom: zoom});
      var AbsoluteMoveResponse = { };
      return AbsoluteMoveResponse;
    };

    port.RelativeMove = (args) =>  {
      // Update values or keep last known value
      try {pan = args.Translation.PanTilt.attributes.x} catch (err){}; 
      try {tilt = args.Translation.PanTilt.attributes.y} catch (err){}; 
      try {zoom = args.Translation.Zoom.attributes.x} catch (err){}; 
      if (this.callback) this.callback('relative-ptz', { pan: pan, tilt: tilt, zoom: zoom});
      var RelativeMoveResponse = { };
      return RelativeMoveResponse;
    };

    port.Stop = (args) =>  {
      // Update values (to zero) or keep last known value
      var pan_tilt_stop = false;
      var zoom_stop = false;
      try {pan_tilt_stop = args.PanTilt} catch (err){}; 
      try {zoom_stop = args.Zoom} catch (err){};
      if (pan_tilt_stop) {
        pan = 0;
        tilt = 0;
      }
      if (zoom_stop) {
        zoom = 0;
      } 
      if (this.callback) this.callback('ptz', { pan: pan, tilt: tilt, zoom: zoom});
      var StopResponse = { };
      return StopResponse;
    };



    port.GetPresets = (args) => {
      var GetPresetsResponse = { Preset: [] };
      var matching_profileToken = args.ProfileToken;

      for (var i = 0 ; i < this.presetArray.length; i++) {
        if (this.presetArray[i].profileToken === matching_profileToken
        && this.presetArray[i].used == true) {
          var p = {
            attributes: {
              token: this.presetArray[i].presetToken
            },
            Name: this.presetArray[i].presetName
          };
          GetPresetsResponse.Preset.push(p);
        }
      }
      return GetPresetsResponse;
    };


    port.GotoPreset = (args) => {
      var GotoPresetResponse = { };
      var matching_profileToken = args.ProfileToken;
      var matching_presetToken = args.PresetToken;

      for (var i = 0 ; i < this.presetArray.length; i++) {
        if (matching_profileToken === this.presetArray[i].profileToken
        && matching_presetToken === this.presetArray[i].presetToken
        && this.presetArray[i].used == true) {
          if (this.callback) this.callback('gotopreset', { name: this.presetArray[i].presetName,
            value: this.presetArray[i].presetToken });
          break;
        }
      }
      return GotoPresetResponse;
    };

    port.RemovePreset = (args) => {
      var RemovePresetResponse = { };

      var matching_profileToken = args.ProfileToken;
      var matching_presetToken = args.PresetToken;

      for (var i = 0 ; i < this.presetArray.length; i++) {
        if (matching_profileToken === this.presetArray[i].profileToken
        && matching_presetToken === this.presetArray[i].presetToken) {
          this.presetArray[i].used = false;
          if (this.callback) this.callback('clearpreset', { name: this.presetArray[i].presetName,
            value: this.presetArray[i].presetToken });
          break;
        }
      }

      return RemovePresetResponse;
    };

    port.SetPreset = (args) => {

      var SetPresetResponse;

      var profileToken = args.ProfileToken;
      var presetName = args.PresetName;   // used when creating a preset 
      var presetToken = args.PresetToken; // used when updating an existing preset


      if (presetToken) {
        for (var i = 0; i < this.presetArray.length; i++) {
          if (profileToken === this.presetArray[i]
          && presetToken === this.presetArray[i]) {
            this.presetArray[i].presetName = presetName;
            this.presetArray[i].used = true;
           if (this.callback) this.callback('setpreset', { name: presetName,
            value: presetToken });
          break;
          }
        SetPresetResponse = { PresetToken : presetToken};

        return SetPresetResponse;
        }
      } else {
        // Check if the preset name is a number (special case)
        var special_case_name = false;
        try {
          var preset_name_value = parseInt(presetName);
          if (preset_name_value > 0 && preset_name_value < 255) {
            special_case_name = true;
          }
        } catch (err) {
        }
        if (special_case_name) {
          if (this.callback) this.callback('setpreset', { name: presetName,
              value: presetName });
          SetPresetResponse = { PresetToken : presetName};
          return SetPresetResponse;
        } else {
          // Find the first unused token and use it
          var new_presetToken = '';
          for (var i = 0; i < this.presetArray.length; i++) {
            if (profileToken === this.presetArray[i].profileToken
            && this.presetArray[i].used == false) {
              this.presetArray[i].presetName = presetName;
              this.presetArray[i].used = true;
              new_presetToken = this.presetArray[i].presetToken;
              if (this.callback) this.callback('setpreset', { name: presetName,
                value: new_presetToken });
              break;
            }
          }
          SetPresetResponse = { PresetToken : new_presetToken};
          return SetPresetResponse;
        }
      }
    };
  }
}
export = PTZService;
