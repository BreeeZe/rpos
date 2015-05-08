///<reference path="../typings/tsd.d.ts" />
///<reference path="../typings/rpos/rpos.d.ts" />
import fs = require("fs");
import util = require("util");
import SoapService = require('../lib/SoapService');
import { Utils }  from '../lib/utils';
import url = require('url');
import { Server } from 'http';
import Camera = require('../lib/camera');
var utils = Utils.utils;

class MediaService extends SoapService {
  media_service: any;
  camera: Camera;

  constructor(config: rposConfig, server: Server, camera: Camera) {
    super(config, server);
    this.media_service = require('./stubs/media_service.js').MediaService;

    this.camera = camera;
    this.serviceOptions = {
      path: '/onvif/media_service',
      services: this.media_service,
      xml: fs.readFileSync('./wsdl/media_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/media_service.wsdl',
      onReady: function() {
        utils.log.info('media_service started');
      }
    };
  }

  starting() {
    var listeners = this.webserver.listeners('request').slice();
    this.webserver.removeAllListeners('request');
    this.webserver.addListener('request', (request, response, next)=> {
      utils.log.debug('web request received : %s', request.url);

      var uri = url.parse(request.url, true);
      var action = uri.pathname;
      if (action == '/web/snapshot.jpg') {
        try {
          var img = fs.readFileSync('/dev/shm/snapshot.jpg');
          response.writeHead(200, { 'Content-Type': 'image/jpg' });
          response.end(img, 'binary');
        } catch (err) {
          utils.log.error("Error opening snapshot : %s", err);
          response.end("404: Not Found: " + request);
        }
      } else {
        for (var i = 0, len = listeners.length; i < len; i++) {
          listeners[i].call(this, request, response, next);
        }
      }
    });
  };

  started() {
    this.camera.startRtsp();
  };

  extendService() {
    var port = this.media_service.MediaService.Media;

    var cameraOptions = this.camera.options;
    var cameraSettings = this.camera.settings;
    var camera = this.camera;

    var videoConfigurationOptions = {
      QualityRange: {
        Min: cameraOptions.quality[0],
        Max: cameraOptions.quality[cameraOptions.quality.length - 1]
      },
      H264: {
        ResolutionsAvailable: cameraOptions.resolutions,
        GovLengthRange: { Min: 1, Max: 10 },
        FrameRateRange: {
          Min: cameraOptions.framerates[0],
          Max: cameraOptions.framerates[cameraOptions.framerates.length - 1]
        },
        EncodingIntervalRange: { Min: 1, Max: 1 },
        H264ProfilesSupported: cameraOptions.profiles
      },
      Extension: {
        H264: {
          ResolutionsAvailable: cameraOptions.resolutions,
          GovLengthRange: { Min: 1, Max: 10 },
          FrameRateRange: {
            Min: cameraOptions.framerates[0],
            Max: cameraOptions.framerates[cameraOptions.framerates.length - 1]
          },
          EncodingIntervalRange: { Min: 1, Max: 1 },
          H264ProfilesSupported: cameraOptions.profiles,
          BitrateRange: {
            Min: cameraOptions.bitrates[0],
            Max: cameraOptions.bitrates[cameraOptions.bitrates.length - 1]
          }
        }
      }
    };

    var videoEncoderConfiguration = {
      attributes: {
        token: "token"
      },
      Name: "PiCameraConfiguration",
      UseCount: 0,
      Encoding: "H264",
      Resolution: {
        Width: cameraSettings.resolution.Width,
        Height: cameraSettings.resolution.Height
      },
      Quality: cameraSettings.bitrate ? null : cameraSettings.quality,
      RateControl: {
        FrameRateLimit: cameraSettings.framerate,
        EncodingInterval: 1,
        BitrateLimit: cameraSettings.bitrate
      },
      H264: {
        GovLength: cameraSettings.gop,
        H264Profile: cameraSettings.profile
      },
      SessionTimeout: "1000"
    };

    var videoSourceConfiguration = {
      Name: "Primary Source",
      UseCount: 0,
      attributes: {
        token: "token"
      },
      SourceToken: [],
      Bounds: { attributes: { x: 0, y: 0, width: 1920, height: 1080 } }
    };

    var audioEncoderConfigurationOptions = {
      Options: []
    };

    var profile = {
      Name: "CurrentProfile",
      attributes: {
        token: "token"
      },
      VideoSourceConfiguration: videoSourceConfiguration,
      VideoEncoderConfiguration: videoEncoderConfiguration
    };

    port.GetServiceCapabilities = (args /*, cb, headers*/)=> {
      var GetServiceCapabilitiesResponse = {
        Capabilities: {
          attributes: {
            SnapshotUri: false,
            Rotation: false,
            VideoSourceMode: true,
            OSD: false
          },
          ProfileCapabilities: {
            attributes: {
              MaximumNumberOfProfiles: 1
            }
          },
          StreamingCapabilities: {
            attributes: {
              RTPMulticast: false,
              RTP_TCP: true,
              RTP_RTSP_TCP: true,
              NonAggregateControl: false,
              NoRTSPStreaming: false
            }
          }
        }
      };
      return GetServiceCapabilitiesResponse;
    };
  
    //var GetStreamUri = { 
    //StreamSetup : { 
    //Stream : { xs:string}
    //},
    //ProfileToken : { xs:string}
    //
    //};
    port.GetStreamUri = (args /*, cb, headers*/)=> {
      var GetStreamUriResponse = {
        MediaUri: {
          Uri: `rtsp://${utils.getIpAddress()}:${this.config.RTSPPort}/${this.config.RTSPName}`,
          InvalidAfterConnect: false,
          InvalidAfterReboot: false,
          Timeout: "PT30S"
        }
      };
      return GetStreamUriResponse;
    };

    port.GetProfile = (args)=> {
      var GetProfileResponse = { Profile: profile };
      return GetProfileResponse;
    };

    port.GetProfiles = (args)=> {
      var GetProfilesResponse = { Profiles: [profile] };
      return GetProfilesResponse;
    };

    port.CreateProfile = (args)=> {
      var CreateProfileResponse = { Profile: profile };
      return CreateProfileResponse;
    };

    port.DeleteProfile = (args)=> {
      var DeleteProfileResponse = {};
      return DeleteProfileResponse;
    };

    port.GetVideoSourceConfigurations = (args)=> {
      var GetVideoSourceConfigurationsResponse = { Configurations: [videoSourceConfiguration] };
      return GetVideoSourceConfigurationsResponse;
    };

    port.GetVideoEncoderConfigurations = (args)=> {
      var GetVideoEncoderConfigurationsResponse = { Configurations: [videoEncoderConfiguration] };
      return GetVideoEncoderConfigurationsResponse;
    };

    port.GetVideoEncoderConfiguration = (args)=> {
      var GetVideoEncoderConfigurationResponse = { Configuration: videoEncoderConfiguration };
      return GetVideoEncoderConfigurationResponse;
    };

    port.SetVideoEncoderConfiguration = (args)=> {
      var settings = {
        bitrate: args.Configuration.RateControl.BitrateLimit,
        framerate: args.Configuration.RateControl.FrameRateLimit,
        gop: args.Configuration.H264.GovLength,
        profile: args.Configuration.H264.H264Profile,
        quality: args.Configuration.Quality instanceof Object ? null : args.Configuration.Quality,
        resolution: args.Configuration.Resolution
      };
      camera.setSettings(settings);

      var SetVideoEncoderConfigurationResponse = {};
      return SetVideoEncoderConfigurationResponse;
    };

    port.GetVideoEncoderConfigurationOptions = (args)=> {
      var GetVideoEncoderConfigurationOptionsResponse = { Options: videoConfigurationOptions };
      return GetVideoEncoderConfigurationOptionsResponse;
    };

    port.GetGuaranteedNumberOfVideoEncoderInstances = (args)=> {
      var GetGuaranteedNumberOfVideoEncoderInstancesResponse = {
        TotalNumber: 1,
        H264: 1
      }
      return GetGuaranteedNumberOfVideoEncoderInstancesResponse;
    };

    port.GetSnapshotUri = (args)=> {
      var GetSnapshotUriResponse = {};
      //  MediaUri : {
      //    Uri : "http://" + config.IpAddress + ":" + config.ServicePort + "/web/snapshot.jpg",
      //    Timeout : "PT30S",
      //    InvalidAfterConnect : false,
      //    InvalidAfterReboot : false
      //  }
      //};
      return GetSnapshotUriResponse;
    };

    port.GetAudioEncoderConfigurationOptions = (args)=> {
      var GetAudioEncoderConfigurationOptionsResponse = { Options: [{}] };
      return GetAudioEncoderConfigurationOptionsResponse;
    };
  }
}
export = MediaService;