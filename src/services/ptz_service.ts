import { Server } from 'http';
import { SoapService } from "../lib/SoapService";
import { RposConfig } from "../lib/config";
import { PTZDriver } from "../lib/PTZDriver";
import { readFileSync } from 'fs';

export class PTZService extends SoapService {
  ptz_service: any;
  callback: any;

  presetArray = [];

  public ptzConfiguration: any;


  constructor(config: RposConfig, server: Server, callback, private ptz_driver: PTZDriver) {
    super(config, server);

    this.ptz_service = require('./stubs/ptz_service.js').PTZService;
    this.callback = callback;
    this.ptz_driver = ptz_driver;

    this.serviceOptions = {
      path: '/onvif/ptz_service',
      services: this.ptz_service,
      xml: readFileSync('./wsdl/ptz_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/ptz_service.wsdl',
      onReady: () => console.log('ptz_service started')
    };

    for (var i = 1; i <=  255; i++) {
      this.presetArray.push({profileToken: 'profile_token', presetName: '', presetToken: i.toString(), used: false});
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
    
    var node = { 
      attributes : {
        token : 'ptz_node_token_0',
        FixedHomePosition: this.ptz_driver.hasFixedHomePosition,
        GeoMove: false
      },
      Name : 'PTZ Node 0',
      SupportedPTZSpaces : {},
      MaximumNumberOfPresets : 255,
      HomeSupported : this.ptz_driver.supportsGoToHome,
      AuxiliaryCommands : ['AUX1on','AUX1off','AUX2on','AUX2off',
      'AUX3on','AUX3off','AUX4on','AUX4off',
      'AUX5on','AUX5off','AUX6on','AUX6off',
      'AUX7on','AUX7off','AUX8on','AUX8off']
    }
    
    if (this.ptz_driver.supportsAbsolutePTZ) {
      node.SupportedPTZSpaces['AbsolutePanTiltPositionSpace'] = [{
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
      node.SupportedPTZSpaces['RelativePanTiltTranslationSpace'] = [{
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
      node.SupportedPTZSpaces['ContinuousPanTiltVelocitySpace'] = [{ 
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
      node.SupportedPTZSpaces['ContinuousZoomVelocitySpace'] =  [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace',
          XRange : { 
            Min : -1.0,
            Max : 1.0
          }
        }];
    }
    if (this.ptz_driver.supportsRelativePTZ || this.ptz_driver.supportsAbsolutePTZ) {
      node.SupportedPTZSpaces['PanTiltSpeedSpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/GenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }];
      node.SupportedPTZSpaces['ZoomSpeedSpace'] = [{ 
          URI : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/ZoomGenericSpeedSpace',
          XRange : { 
            Min : 0,
            Max : 1
          }
        }];
    }

    // ptzConfigurations is an Array.
    var ptzConfigurationOptions = {
      Spaces: node.SupportedPTZSpaces,
      PTZTimeout : { 
        Min : 'PT0S',
        Max : 'PT10S'
      },
    };
    
    this.ptzConfiguration = {
      attributes: {
        token: "ptz_config_token_0"
      },
      Name: "PTZ Configuration",
      UseCount: 1,
      NodeToken: "ptz_node_token_0",
      DefaultAbsolutePantTiltPositionSpace : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/PositionGenericSpace',
      DefaultAbsoluteZoomPositionSpace : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/PositionGenericSpace',
      DefaultRelativePanTiltTranslationSpace : 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/TranslationGenericSpace',
      DefaultRelativeZoomTranslationSpace : 'http://www.onvif.org/ver10/tptz/ZoomSpaces/TranslationGenericSpace',
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

        
    port.GetConfiguration = (args) => {
      // ToDo. Check token and return a valid response or an error reponse
      var GetConfigurationResponse = { PTZConfiguration: this.ptzConfiguration };
      return GetConfigurationResponse;
    };
	
    port.GetConfigurations = (args) => {
      var GetConfigurationsResponse = { PTZConfiguration: this.ptzConfiguration };
      return GetConfigurationsResponse;
    };

//    port.GetCompatibleConfigurations = (args) => {
//      var GetCompatibleConfigurationsResponse = { };
//      return GetCompatibleConfigurationsResponse;
//    };

    port.GetNode = (args) => {
	  // ToDo. Check token and return a valid response or an error reponse
      var GetNodeResponse = { PTZNode: node };
      return GetNodeResponse;
    };

    port.GetNodes = (args) => {
      var GetNodesResponse = { PTZNode: node };
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
      // ODM sends PanTilt OR Zoom but not both
      // Other VMS systems can send PanTilt AND Zoom together
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
      // ODM just sends Zoom:true or PanTilt:true
      // Other VMS systems could stop Zoom and PanTilt in one command
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


    //var SendAuxiliaryCommand = { 
    //  ProfileToken : { xs:string},
    //  AuxiliaryData : { xs:string}
    //};
    port.SendAuxiliaryCommand = (args) => {
      if (this.callback) this.callback('aux', { name: args.AuxiliaryData });
      var SendAuxiliaryCommandResponse = { 
        AuxiliaryResponse : true // no idea what the value should be
      };
      return SendAuxiliaryCommandResponse;
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