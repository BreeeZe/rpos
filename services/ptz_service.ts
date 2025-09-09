///<reference path="../rpos.d.ts" />

import fs = require("fs");
import util = require("util");
import os = require('os');
import SoapService = require('../lib/SoapService');
import { Utils }  from '../lib/utils';
import { Server } from 'http';
import PTZDriver = require('../lib/PTZDriver');

var utils = Utils.utils;

class PTZService extends SoapService {
  ptz_service: any;
  callback: any;
  ptz_driver: PTZDriver;
  profilesArray: Profile[];

  presetsFilename = "presets.json";

  presetArray = [];

  public ptzConfigurationsArray: any[] = [];


  constructor(config: rposConfig, server: Server, callback, ptz_driver: PTZDriver, profilesArray: Profile[]) {
    super(config, server);

    this.profilesArray = profilesArray;
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

    // Load presets, or Create empty presets
    
    let presetsLoaded = false;
    if (fs.existsSync(this.presetsFilename)) {
      try {
        let buffer = fs.readFileSync(this.presetsFilename);
        this.presetArray = JSON.parse(buffer.toString());
        presetsLoaded = true;
      } catch (err) {
        presetsLoaded = false;
      }
    }

    if (presetsLoaded == false) {

      // Create all the Presets, with used: set to false
      for (let i = 1; i <= this.config.Cameras.length; i++) {

        // Create all the presets
        // There is a PTZ Node for each camera
        for (let p = 1; p <=  (this.ptz_driver.numPresets); p++) {
          this.presetArray.push(
            {
              ptzNodeToken: 'ptz_node_token_' + i.toString().padStart(2,'0'),
              presetName: '', // Preset ' + i.toString(),
              presetToken: i.toString(),
              used: false,
              fixed: false // RPOS uses fixed to make a preset that cannot be deleted - eg for Wipe, or Camera Menu Preset 95 on Pelco
            }
          );
        }  
      }
      // create the presets file
      try {
        fs.writeFileSync(this.presetsFilename, JSON.stringify(this.presetArray, null, 4));
      } catch (err) {
        // failed to write
        console.log("failed to write presets file");
      }

    }
    
    this.extendService();
  }

  leftPad(number, targetLength) {
    var output = number + '';
    while (output.length < targetLength) {
        output = '0' + output;
    }
    return output;
  }

  extendService() {
    var port = this.ptz_service.PTZService.PTZ;
    
    let nodesArray = [];

    // PTZ Node is the lowest level in the PTZ system

    for (let i = 1; i <= this.config.Cameras.length; i++) {
      let newNode = { 
      attributes : {
          token: `ptz_node_token_${i.toString().padStart(2, '0')}`,
        FixedHomePosition: this.ptz_driver.hasFixedHomePosition,
        GeoMove: false
      },
        Name: `PTZ Node ${i}`,
      SupportedPTZSpaces : {}, // filled in with code below
      MaximumNumberOfPresets : this.ptz_driver.numPresets, // eg 64 for Visca. 255 for Pelco
      HomeSupported : this.ptz_driver.supportsGoToHome,
      AuxiliaryCommands : ['AUX1on','AUX1off','AUX2on','AUX2off',
      'AUX3on','AUX3off','AUX4on','AUX4off',
      'AUX5on','AUX5off','AUX6on','AUX6off',
      'AUX7on','AUX7off','AUX8on','AUX8off']
    }

    if (this.ptz_driver.supportsAbsolutePTZ) {
      newNode.SupportedPTZSpaces['AbsolutePanTiltPositionSpace'] = [{
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
      newNode.SupportedPTZSpaces['RelativePanTiltTranslationSpace'] = [{
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
      newNode.SupportedPTZSpaces['ContinuousPanTiltVelocitySpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace',
          XRange : { 
            Min : -1.0,
            Max : 1.0
          },
          YRange : { 
            Min : -1.0,
            Max : 1.0
          }
        }];
      newNode.SupportedPTZSpaces['ContinuousZoomVelocitySpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
          XRange : { 
            Min : -1.0,
            Max : 1.0
          }
        }];
    }
    if (this.ptz_driver.supportsRelativePTZ || this.ptz_driver.supportsAbsolutePTZ) {
      newNode.SupportedPTZSpaces['PanTiltSpeedSpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/GenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }];
      newNode.SupportedPTZSpaces['ZoomSpeedSpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/ZoomGenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }];
    }
      nodesArray.push(newNode);
    }


    // PTZ Configuration takes a PTZ Node and adds some Defaults like the Default Space and the Default Speed

    for (let i = 1; i <= this.config.Cameras.length; i++) {

      let newItem = {
      attributes: {
          token: `ptz_config_token_${i.toString().padStart(2, '0')}`
      },
        Name: `PTZ Configuration ${i.toString()}`,
      UseCount: 1,
        NodeToken: `ptz_node_token_${i.toString().padStart(2, '0')}`,
        DefaultAbsolutePantTiltPositionSpace: 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/PositionGenericSpace',
        DefaultAbsoluteZoomPositionSpace: 'http://www.onvif.org/ver10/tptz/ZoomSpaces/PositionGenericSpace',
        DefaultRelativePanTiltTranslationSpace: 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/TranslationGenericSpace',
        DefaultRelativeZoomTranslationSpace: 'http://www.onvif.org/ver10/tptz/ZoomSpaces/TranslationGenericSpace',
        DefaultContinuousPanTiltVelocitySpace: 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace',
        DefaultContinuousZoomVelocitySpace: 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
        DefaultPTZSpeed: { 
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

      this.ptzConfigurationsArray.push(newItem);
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

      let ptzConfigurationOptions = {
        Spaces: nodesArray[0].SupportedPTZSpaces, // TODO - Need to select corrct node from the Nodes Array. Hard coded to first item !!
        PTZTimeout: {
          Min: 'PT0S',
          Max: 'PT10S'
        },
      };

      var GetConfigurationOptionsResponse = { PTZConfigurationOptions: ptzConfigurationOptions };
      return GetConfigurationOptionsResponse;
    };

        
    port.GetConfiguration = (args) => {
      // ToDo. Check token and return a valid response or an error reponse
      var GetConfigurationResponse = { PTZConfiguration: this.ptzConfigurationsArray[0] }; // TODO = get the correct config for the token provided
      return GetConfigurationResponse;
    };
	
    port.GetConfigurations = (args) => {
      var GetConfigurationsResponse = { PTZConfiguration: this.ptzConfigurationsArray };
      return GetConfigurationsResponse;
    };

//    port.GetCompatibleConfigurations = (args) => {
//      var GetCompatibleConfigurationsResponse = { };
//      return GetCompatibleConfigurationsResponse;
//    };

    port.GetNode = (args) => {
      let nodeToken = args.NodeToken;

      let node = nodesArray.find(item => item.attributes.token == nodeToken);

      // TODO Add error case where NodeToken is not found

      let GetNodeResponse = { PTZNode: node };
      return GetNodeResponse;
    };

    port.GetNodes = (args) => {
      let GetNodesResponse = { PTZNode: nodesArray };
      return GetNodesResponse;
    };

    port.GetStatus = (arg) => {
      // ToDo. Check token and return a valid response or an error reponse

      var now = new Date();
      var utc = now.getUTCFullYear() + '-' + this.leftPad((now.getUTCMonth()+1),2) + '-' + this.leftPad(now.getUTCDate(),2) + 'T'
            + this.leftPad(now.getUTCHours(),2) + ':' + this.leftPad(now.getUTCMinutes(),2) + ':' + this.leftPad(now.getUTCSeconds(),2) + 'Z';

      var GetStatusResponse = { 
	PTZStatus: {
	  UtcTime: utc
        }
      };
      return GetStatusResponse;
    };

    port.SetHomePosition = (args) => {
      if (this.callback) this.callback('sethome', {});
      var SetHomePositionResponse = { };
      return SetHomePositionResponse;
    };

    port.GotoHomePosition = (args) => {

      // Find the ProfileToken in the Profiles Array. Then get the PTZConfiguration
      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const camID = Number(profile.PTZConfiguration.NodeToken.substring(15));// Strip "ptz_node_token_" and we can use this to index into the config.Cameras Array
      const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

      if (this.callback) this.callback('gotohome', { cameraAddress: cameraAddress });
      let GotoHomePositionResponse = {};
      return GotoHomePositionResponse;
    };

    var pan = 0;
    var tilt = 0;
    var zoom = 0;
    var timeout = '';

    port.ContinuousMove = (args) =>  {
      // Update values or keep last known value
      // ODM sends PanTilt OR Zoom but not both
      // Other VMS systems can send PanTilt AND Zoom together

      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const camID = Number(profile.PTZConfiguration.NodeToken.substring(15));// Strip "ptz_node_token_" and we can use this to index into the config.Cameras Array
      const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'


      try {pan = args.Velocity.PanTilt.attributes.x} catch (err){}; 
      try {tilt = args.Velocity.PanTilt.attributes.y} catch (err){}; 
      try {zoom = args.Velocity.Zoom.attributes.x} catch (err){}; 
      try {timeout = args.Timeout} catch (err){}; 
      if (this.callback) this.callback('ptz', { pan: pan, tilt: tilt, zoom: zoom, cameraAddress: cameraAddress });
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
      // ODM just sends Zoom:true or PanTilt:true
      // Other VMS systems could stop Zoom and PanTilt in one command
      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const camID = Number(profile.PTZConfiguration.NodeToken.substring(15));// Strip "ptz_node_token_" and we can use this to index into the config.Cameras Array
      const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

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
      if (this.callback) this.callback('ptz', { pan: pan, tilt: tilt, zoom: zoom, cameraAddress: cameraAddress });
      var StopResponse = { };
      return StopResponse;
    };


    //var SendAuxiliaryCommand = { 
    //  ProfileToken : { xs:string},
    //  AuxiliaryData : { xs:string}
    //};
    port.SendAuxiliaryCommand = (args) => {
      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const camID = Number(profile.PTZConfiguration.NodeToken.substring(15));// Strip "ptz_node_token_" and we can use this to index into the config.Cameras Array
      const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

      if (this.callback) this.callback('aux', { name: args.AuxiliaryData, cameraAddress: cameraAddress });
      var SendAuxiliaryCommandResponse = { 
        AuxiliaryResponse : true // no idea what the value should be
      };
      return SendAuxiliaryCommandResponse;
    };

    port.GetPresets = (args) => {

      // Take the Media Profile Token (passed in) and get the PTZ Node and then return the relevent list of presets for that Node
      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const ptz_node_token = profile.PTZConfiguration.NodeToken; // eg ptz_node_token_01

      var GetPresetsResponse = { Preset: [] };

      for (let i = 0 ; i < this.presetArray.length; i++) {
        if (this.presetArray[i].ptzNodeToken === ptz_node_token
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
      const arg_presetToken = args.PresetToken;
      
      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const ptzNodeToken = profile.PTZConfiguration.NodeToken;
      const camID = Number(ptzNodeToken.substring(15));// Strip "ptz_node_token_" and we can use this to index into the config.Cameras Array
      const cameraPTZAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

      // Args has a PresetToken and a ProfileToken
      let GotoPresetResponse = { };

      for (let i = 0 ; i < this.presetArray.length; i++) {
        if (ptzNodeToken === this.presetArray[i].ptzNodeToken
        && arg_presetToken === this.presetArray[i].presetToken
        && this.presetArray[i].used == true) {
          if (this.callback) this.callback('gotopreset', { name: this.presetArray[i].presetName,
            value: this.presetArray[i].presetToken, cameraAddress: cameraPTZAddress
          });
          break;
        }
      }
      return GotoPresetResponse;
    };

    port.RemovePreset = (args) => {
      // find the preset in the array of presets and set "used" to false
      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const ptzNodeToken = profile.PTZConfiguration.NodeToken;
      const camID = Number(ptzNodeToken.substring(15));// Strip "ptz_node_token_" and we can use this to index into the config.Cameras Array
      const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'

      let RemovePresetResponse = { };

      let matching_presetToken = args.PresetToken;

      for (let i = 0 ; i < this.presetArray.length; i++) {
        if (ptzNodeToken === this.presetArray[i].ptzNodeToken
        && matching_presetToken === this.presetArray[i].presetToken
        && this.presetArray[i].fixed == false) {
          // update the array, then schedule a save to disk
          this.presetArray[i].used = false; // set used to false
          this.presetArray[i].name = ""; // clear the name
          if (this.callback) this.callback('clearpreset', { name: this.presetArray[i].presetName,
            value: this.presetArray[i].presetToken, cameraAddress: cameraAddress
          });
          try {
            fs.writeFileSync(this.presetsFilename, JSON.stringify(this.presetArray, null, 4));
          } catch (err) {
            // failed to write
            console.log("failed to write presets file");
          }
          break;
        }
      }

      return RemovePresetResponse;
    };

    port.SetPreset = (args) => {
      // Find the first preset slot that is unused
      const profile = this.profilesArray.find(item => item.attributes.token == args.ProfileToken);
      const ptzNodeToken = profile.PTZConfiguration.NodeToken;
      const camID = Number(ptzNodeToken.substring(15));// Strip "ptz_node_token_" and we can use this to index into the config.Cameras Array
      const cameraAddress = Number(this.config.Cameras[camID - 1].PTZCameraAddress) || 1; // array starts from Index 0. Default camera address is '1'


      let SetPresetResponse;

      let presetName = args.PresetName;   // used when creating a preset 
      let presetToken = args.PresetToken; // used when updating an existing preset
                                          // Note ODM's Create Preset supplies a Preset Token, but we ignore it

      let existingPreset = null;
      if ('PresetToken' in args && args.PresetToken.length > 0) {
        // check for existing preset
        existingPreset = this.presetArray.find(item => item.ptz_node_token == ptzNodeToken && item.PresetToken == args.PresetToken);
      }


      // If the ONVIF command contains no Preset Token, this is a NEW Preset and we return the new Preset Token in our reply.
      // If the ONVIF command contains a Preset Token, and that Preset Token already existins in our array of Presets, then this is an UPDATE. We may have to UPDATE the Name too.
      // If the ONVIF command contains an Unknown Preset Token (like ODM does) we treat this as a NEW Preset and ignore the unknown Preset Token. We return the actual new Preset Token in the reply.

      // CHECK FOR UPDATE
      if (existingPreset != null && existingPreset != undefined) {
        // Optional update of the name
        if ('PresetName' in args && existingPreset.PresetName != args.PresetName) {
          existingPreset.PresetName = args.PresetName;
          try {
            fs.writeFileSync(this.presetsFilename, JSON.stringify(this.presetArray, null, 4));
          } catch (err) {
            // failed to write
            console.log("failed to write presets file");
          }
        }
        // Send to the physical camera device
        if (this.callback) this.callback('setpreset', { name: presetName,
          value: presetToken, cameraAddress: cameraAddress
          });

        SetPresetResponse = { PresetToken : presetToken};

        return SetPresetResponse;
      } else {
        // New Preset
        // Find the first unused token and use it
        let new_presetToken = '';
        for (let i = 0; i < this.presetArray.length; i++) {
          if (ptzNodeToken === this.presetArray[i].ptzNodeToken
          && this.presetArray[i].used == false) {
            this.presetArray[i].presetName = presetName;
            this.presetArray[i].used = true;
            new_presetToken = this.presetArray[i].presetToken;
            if (this.callback) this.callback('setpreset', { name: presetName,
              value: new_presetToken, cameraAddress: cameraAddress
            });
            break;
          }
        }

        try {
          fs.writeFileSync(this.presetsFilename, JSON.stringify(this.presetArray, null, 4));
        } catch (err) {
          // failed to write
          console.log("failed to write presets file");
        }

        SetPresetResponse = { PresetToken : new_presetToken};
        return SetPresetResponse;
      }
    };
  }
}
export = PTZService;
