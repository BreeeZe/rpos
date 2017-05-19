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

  presetArray = [];

  constructor(config: rposConfig, server: Server, callback) {
    super(config, server);

    this.ptz_service = require('./stubs/ptz_service.js').PTZService;
    this.callback = callback;

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

    var ptzConfigurationOptions = { 
          Spaces : { 
              ContinuousPanTiltVelocitySpace : [{ 
                URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace',
                XRange : { 
                  Min : -1,
                  Max : 1
                },
                YRange : { 
                  Min : -1,
                  Max : 1
                }
              }],
              ContinuousZoomVelocitySpace : [{ 
                URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
                XRange : { 
                  Min : -1,
                  Max : 1
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
                URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/GenericSpeedSpace',
                XRange : { 
                  Min : 0,
                  Max : 1
                }
              }],
            },
            PTZTimeout : { 
              Min : 'PT0S',
              Max : 'PT10S'
            },
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
      DefaultContinuousPanTiltVelocitySpace : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace',
      DefaultContinuousZoomVelocitySpace : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
      DefaultPTZSpeed : { 
        PanTilt : { 
          attributes : {
            x : 1.0,
            y : 1.0,
            space : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace'
          }
        },
        Zoom : { 
          attributes : {
            x : 1,
            space : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace'
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

    var node = { 
      attributes : {
        token : 'ptz_node_token_0',
      },
      Name : 'PTZ Node 0',
      SupportedPTZSpaces : { 
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
