///<reference path="../rpos.d.ts" />

import fs = require("fs");
import util = require("util");
import SoapService = require('../lib/SoapService');
import { Utils }  from '../lib/utils';
import url = require('url');
import { Server } from 'http';
import Camera = require('../lib/camera');
import { v4l2ctl } from '../lib/v4l2ctl';
import { exec } from 'child_process';
import PTZService = require('./ptz_service');
var utils = Utils.utils;

class MediaService extends SoapService {
  media_service: any;
  camera: Camera;
  ptz_service: PTZService;
  ffmpeg_process: any = null;
  ffmpeg_responses: any[] = [];

  constructor(config: rposConfig, server: Server, camera: Camera, ptz_service: PTZService) {
    super(config, server);
    this.media_service = require('./stubs/media_service.js').MediaService;

    this.camera = camera;
    this.ptz_service = ptz_service;
    this.serviceOptions = {
      path: '/onvif/media_service',
      services: this.media_service,
      xml: fs.readFileSync('./wsdl/media_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/media_service.wsdl',
      onReady: function() {
        utils.log.info('media_service started');
      }
    };
    
    this.extendService();
  }

  starting() {
    var listeners = this.webserver.listeners('request').slice();
    this.webserver.removeAllListeners('request');
    this.webserver.addListener('request', (request, response, next) => {
      utils.log.debug('web request received : %s', request.url);

      var uri = url.parse(request.url, true);
      var action = uri.pathname;
      if (action == '/web/snapshot.jpg') {
        try {
          if (this.ffmpeg_process != null) {
            utils.log.info("ffmpeg - already running");
            this.ffmpeg_responses.push(response);
          } else {
            var cmd = `ffmpeg -fflags nobuffer -probesize 256 -rtsp_transport tcp -i rtsp://127.0.0.1:${this.config.RTSPPort}/${this.config.RTSPName} -vframes 1  -r 1 -s 640x360 -y /dev/shm/snapshot.jpg`;
            var options = { timeout: 15000 };
            utils.log.info("ffmpeg - starting");
            this.ffmpeg_responses.push(response);
            this.ffmpeg_process = exec(cmd, options, (error, stdout, stderr) => {
              // callback
              utils.log.info("ffmpeg - finished");
              if (error) {
                utils.log.warn('ffmpeg exec error: %s', error);
              }
              // deliver the JPEG (or the logo jpeg file)
              for (let responseItem of this.ffmpeg_responses) {
                this.deliver_jpg(responseItem); // response.Write() and response.End()
              }
              // empty the list of responses
              this.ffmpeg_responses = [];
              this.ffmpeg_process = null;
            });
          }
        } catch (err) {
          utils.log.warn('Error ' + err);
        }
      } else {
        for (var i = 0, len = listeners.length; i < len; i++) {
          listeners[i].call(this, request, response, next);
        }
      }
    });
  }

  deliver_jpg(response: any){
    try {
      var img = fs.readFileSync('/dev/shm/snapshot.jpg');
      response.writeHead(200, { 'Content-Type': 'image/jpg' });
      response.end(img, 'binary');
      return;
    } catch (err) {
      utils.log.debug("Error opening snapshot : %s", err);
    }
    try {
      var img = fs.readFileSync('./web/snapshot.jpg');
      response.writeHead(200, { 'Content-Type': 'image/jpg' });
      response.end(img, 'binary');
      return;
    } catch (err) {
      utils.log.debug("Error opening snapshot : %s", err);
    }

    // Return 400 error
    response.writeHead(400, { 'Content-Type': 'text/plain' });
    response.end('JPEG unavailable');
  }

  started() {
    this.camera.startRtsp();
  }

  extendService() {
    var port = this.media_service.MediaService.Media;

    var cameraOptions = this.camera.getOptions();
    var camera = this.camera;

    var videoConfigurationOptions = {
      QualityRange: {
        Min: 0,
        Max: 1
      },
      H264: {
        ResolutionsAvailable: cameraOptions.resolutions,
        GovLengthRange: cameraOptions.gop,
        FrameRateRange: {
          Min: cameraOptions.framerate[0],
          Max: cameraOptions.framerate[cameraOptions.framerate.length - 1]
        },
        EncodingIntervalRange: { Min: 1, Max: 1 },
        H264ProfilesSupported: cameraOptions.h264Profiles
      },
      Extension: {
        H264: {
          ResolutionsAvailable: cameraOptions.resolutions,
          GovLengthRange: cameraOptions.gop,
          FrameRateRange: {
            Min: cameraOptions.framerate[0],
            Max: cameraOptions.framerate[cameraOptions.framerate.length - 1]
          },
          EncodingIntervalRange: { Min: 1, Max: 1 },
          H264ProfilesSupported: cameraOptions.h264Profiles,
          BitrateRange: {
            Min: cameraOptions.bitrate[0],
            Max: cameraOptions.bitrate[cameraOptions.bitrate.length - 1]
          }
        }
      }
    };

    var _videoEncoderConfiguration = {
      attributes: {
        token: "encoder_config_token"
      },
      Name: "PiCameraConfiguration",
      UseCount: 0,
      Encoding: "H264",
      Resolution: {
        Width: this.camera.resolution.Width,
        Height: this.camera.resolution.Height
      },
      Quality: undefined,
      RateControl: {
        FrameRateLimit: this.camera.framerate,
        EncodingInterval: 1,
        BitrateLimit: undefined,
      },
      H264: {
        GovLength: undefined,
        H264Profile: undefined,
      },
      Multicast: {
        Address: {
          Type: "IPv4",
          IPv4Address: "0.0.0.0"
        },
        Port: 0,
        TTL:  1,
        AutoStart: false
      },
      SessionTimeout: "PT1000S"
    };

    var videoSource = {
      attributes: {
        token: "video_src_token"
      },
      Framerate: 25,
      Resolution: { Width: 1920, Height: 1280 }
    };

    var videoSourceConfiguration = {
      Name: "Primary Source",
      UseCount: 0,
      attributes: {
        token: "video_src_config_token"
      },
      SourceToken: "video_src_token",
      Bounds: { attributes: { x: 0, y: 0, width: 1920, height: 1080 } }
    };

    var audioEncoderConfigurationOptions = {
      Options: []
    };

    var _profile = {
      Name: "CurrentProfile",
      attributes: {
        token: "profile_token"
      },
      VideoSourceConfiguration: videoSourceConfiguration,
      VideoEncoderConfiguration: undefined,
      PTZConfiguration: this.ptz_service.ptzConfiguration
    };

    const getProfile = () => {
      _profile.VideoEncoderConfiguration = getVideoEncoderConfiguration();
      return _profile;
    };

    const getVideoEncoderConfiguration = () => {
      const settings = camera.getSettings();
      _videoEncoderConfiguration.RateControl.BitrateLimit = settings.bitrate;
      _videoEncoderConfiguration.RateControl.FrameRateLimit = settings.framerate;
      _videoEncoderConfiguration.H264.GovLength = settings.gop;
      _videoEncoderConfiguration.Quality = settings.quality;
      _videoEncoderConfiguration.Resolution = settings.resolution;
      _videoEncoderConfiguration.H264.H264Profile = settings.h264Profile;

      return _videoEncoderConfiguration;
    }

    port.GetServiceCapabilities = (args /*, cb, headers*/) => {
      var GetServiceCapabilitiesResponse = {
        Capabilities: {
          attributes: {
            SnapshotUri: true,
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
              RTPMulticast: this.config.MulticastEnabled,
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
    port.GetStreamUri = (args /*, cb, headers*/) => {

     // Usually RTSP server is on same IP Address as the ONVIF Service
     // Setting RTSPAddress in the config file lets you to use another IP Address
     let rtspAddress = utils.getIpAddress();
     if (this.config.RTSPAddress.length > 0) rtspAddress = this.config.RTSPAddress;

      var GetStreamUriResponse = {
        MediaUri: {
          Uri: (args.StreamSetup.Stream == "RTP-Multicast" && this.config.MulticastEnabled ? 
            `rtsp://${rtspAddress}:${this.config.RTSPPort}/${this.config.RTSPMulticastName}` :
            `rtsp://${rtspAddress}:${this.config.RTSPPort}/${this.config.RTSPName}`),
          InvalidAfterConnect: false,
          InvalidAfterReboot: false,
          Timeout: "PT30S"
        }
      };
      return GetStreamUriResponse;
    };

    port.GetProfile = (args) => {
      var GetProfileResponse = { Profile: getProfile() };
      return GetProfileResponse;
    };

    port.GetProfiles = (args) => {
      var GetProfilesResponse = { Profiles: [getProfile()] };
      return GetProfilesResponse;
    };

    port.CreateProfile = (args) => {
      var CreateProfileResponse = { Profile: getProfile() };
      return CreateProfileResponse;
    };

    port.DeleteProfile = (args) => {
      var DeleteProfileResponse = {};
      return DeleteProfileResponse;
    };

    port.GetVideoSources = (args) => {
        var GetVideoSourcesResponse = { VideoSources: [videoSource] };
        return GetVideoSourcesResponse;
    }

    port.GetVideoSourceConfigurations = (args) => {
      var GetVideoSourceConfigurationsResponse = { Configurations: [videoSourceConfiguration] };
      return GetVideoSourceConfigurationsResponse;
    };

    port.GetVideoSourceConfiguration = (args) => {
        var GetVideoSourceConfigurationResponse = { Configurations: videoSourceConfiguration };
        return GetVideoSourceConfigurationResponse;
    };

    port.GetVideoEncoderConfigurations = (args) => {
      var GetVideoEncoderConfigurationsResponse = { Configurations: [getVideoEncoderConfiguration()] };
      return GetVideoEncoderConfigurationsResponse;
    };

    port.GetVideoEncoderConfiguration = (args) => {
      var GetVideoEncoderConfigurationResponse = { Configuration: getVideoEncoderConfiguration() };
      return GetVideoEncoderConfigurationResponse;
    };

    port.SetVideoEncoderConfiguration = (args) => {
      var settings = {
        bitrate: args.Configuration.RateControl.BitrateLimit,
        framerate: args.Configuration.RateControl.FrameRateLimit,
        gop: args.Configuration.H264.GovLength,
        quality: args.Configuration.Quality instanceof Object ? 1 : args.Configuration.Quality,
        resolution: args.Configuration.Resolution,
        h264Profile: args.Configuration.H264.H264Profile,
      };
      camera.setSettings(settings);

      var SetVideoEncoderConfigurationResponse = {};
      return SetVideoEncoderConfigurationResponse;
    };

    port.GetVideoEncoderConfigurationOptions = (args) => {
      var GetVideoEncoderConfigurationOptionsResponse = { Options: videoConfigurationOptions };
      return GetVideoEncoderConfigurationOptionsResponse;
    };

    port.GetGuaranteedNumberOfVideoEncoderInstances = (args) => {
      var GetGuaranteedNumberOfVideoEncoderInstancesResponse = {
        TotalNumber: 1,
        H264: 1
      }
      return GetGuaranteedNumberOfVideoEncoderInstancesResponse;
    };

    port.GetSnapshotUri = (args) => {
      var GetSnapshotUriResponse = {
        MediaUri : {
          Uri : "http://" + utils.getIpAddress() + ":" + this.config.ServicePort + "/web/snapshot.jpg",
          InvalidAfterConnect : false,
          InvalidAfterReboot : false,
          Timeout : "PT30S"
        }
      };
      return GetSnapshotUriResponse;
    };

    port.GetAudioEncoderConfigurationOptions = (args) => {
      var GetAudioEncoderConfigurationOptionsResponse = { Options: [{}] };
      return GetAudioEncoderConfigurationOptionsResponse;
    };

    port.GetCompatibleVideoSourceConfigurations = (args) => {
      // Args contains a ProfileToken
      // We will return all Video Sources as being compatible

      let GetCompatibleVideoSourceConfigurationsResponse = { Configurations: [videoSourceConfiguration] };
      return GetCompatibleVideoSourceConfigurationsResponse;
    }

    port.GetVideoSourceConfigurationOptions = (Args) => {
      // Args will contain a ConfigurationToken or ProfileToken
      var GetVideoSourceConfigurationOptionsResponse = { 
        Options : {
          BoundsRange : { 
            XRange : { 
              Min : 0,
              Max : 0
            },
            YRange : { 
              Min : 0,
              Max : 0
            },
            WidthRange : { 
              Min : 1920,
              Max : 1920
            },
            HeightRange : { 
              Min : 1080,
              Max : 1080
            }
          },
          VideoSourceTokensAvailable : "video_src_token"
          //Extension : { 
            //Rotate : { 
              //Mode : { xs:string},
              //DegreeList : { 
                //Items : [{ xs:int}]
              //},
              //Extension : { }
            //},
            //Extension : { }
          //}
        }
      };
        return GetVideoSourceConfigurationOptionsResponse;
    }
  }
}
export = MediaService;
