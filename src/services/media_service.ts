import { Utils } from '../lib/utils';
import { Server } from 'http';
import { v4l2ctl } from '../lib/v4l2ctl';
import { exec } from 'child_process';
import { SoapService } from "../lib/SoapService";
import { Camera } from "../lib/camera";
import { RposConfig } from "../lib/config";
import { PTZService } from './ptz_service';
import { readFileSync } from 'fs';
import { parse as urlParse } from 'url';

export class MediaService extends SoapService {
  media_service: any;
  ffmpeg_process: any = null;
  ffmpeg_responses: any[] = [];

  constructor(config: RposConfig, server: Server, private camera: Camera, private ptz_service: PTZService) {
    super(config, server);

    this.media_service = require('./stubs/media_service.js').MediaService;
    this.camera = camera;
    this.serviceOptions = {
      path: '/onvif/media_service',
      services: this.media_service,
      xml: readFileSync('./wsdl/media_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/media_service.wsdl',
      onReady: function () {
        Utils.log.info('media_service started');
      }
    };

    this.extendService();
  }

  starting() {
    var listeners = this.webserver.listeners('request').slice();
    this.webserver.removeAllListeners('request');
    this.webserver.addListener('request', (request, response, next) => {
      Utils.log.debug('web request received : %s', request.url);

      var uri = urlParse(request.url, true);
      var action = uri.pathname;
      if (action == '/web/snapshot.jpg') {
        try {
          if (this.ffmpeg_process != null) {
            Utils.log.info("ffmpeg - already running");
            this.ffmpeg_responses.push(response);
          } else {
            var cmd = `ffmpeg -fflags nobuffer -probesize 256 -rtsp_transport tcp -i rtsp://127.0.0.1:${this.config.RTSPPort}/${this.config.RTSPName} -vframes 1  -r 1 -s 640x360 -y /dev/shm/snapshot.jpg`;
            var options = { timeout: 15000 };
            Utils.log.info("ffmpeg - starting");
            this.ffmpeg_responses.push(response);
            this.ffmpeg_process = exec(cmd, options, (error, stdout, stderr) => {
              // callback
              Utils.log.info("ffmpeg - finished");
              if (error) {
                Utils.log.warn('ffmpeg exec error: %s', error);
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
          Utils.log.warn('Error ' + err);
        }
      } else {
        for (var i = 0, len = listeners.length; i < len; i++) {
          listeners[i].call(this, request, response, next);
        }
      }
    });
  }

  deliver_jpg(response: any) {
    try {
      var img = readFileSync('/dev/shm/snapshot.jpg');
      response.writeHead(200, { 'Content-Type': 'image/jpg' });
      response.end(img, 'binary');
      return;
    } catch (err) {
      Utils.log.debug("Error opening snapshot : %s", err);
    }
    try {
      var img = readFileSync('./web/snapshot.jpg');
      response.writeHead(200, { 'Content-Type': 'image/jpg' });
      response.end(img, 'binary');
      return;
    } catch (err) {
      Utils.log.debug("Error opening snapshot : %s", err);
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

    var cameraOptions = this.camera.options;
    var cameraSettings = this.camera.settings;
    var camera = this.camera;

    var h264Profiles = v4l2ctl.Controls.CodecControls.h264_profile.getLookupSet().map(ls => ls.desc);
    h264Profiles.splice(1, 1);

    var videoConfigurationOptions = {
      QualityRange: {
        Min: 1,
        Max: 1
      },
      H264: {
        ResolutionsAvailable: cameraOptions.resolutions,
        GovLengthRange: {
          Min: v4l2ctl.Controls.CodecControls.h264_i_frame_period.getRange().min,
          Max: v4l2ctl.Controls.CodecControls.h264_i_frame_period.getRange().max
        },
        FrameRateRange: {
          Min: cameraOptions.framerates[0],
          Max: cameraOptions.framerates[cameraOptions.framerates.length - 1]
        },
        EncodingIntervalRange: { Min: 1, Max: 1 },
        H264ProfilesSupported: h264Profiles
      },
      Extension: {
        H264: {
          ResolutionsAvailable: cameraOptions.resolutions,
          GovLengthRange: {
            Min: v4l2ctl.Controls.CodecControls.h264_i_frame_period.getRange().min,
            Max: v4l2ctl.Controls.CodecControls.h264_i_frame_period.getRange().max
          },
          FrameRateRange: {
            Min: cameraOptions.framerates[0],
            Max: cameraOptions.framerates[cameraOptions.framerates.length - 1]
          },
          EncodingIntervalRange: { Min: 1, Max: 1 },
          H264ProfilesSupported: h264Profiles,
          BitrateRange: {
            Min: cameraOptions.bitrates[0],
            Max: cameraOptions.bitrates[cameraOptions.bitrates.length - 1]
          }
        }
      }
    };

    var videoEncoderConfiguration = {
      attributes: {
        token: "encoder_config_token"
      },
      Name: "PiCameraConfiguration",
      UseCount: 0,
      Encoding: "H264",
      Resolution: {
        Width: cameraSettings.resolution.Width,
        Height: cameraSettings.resolution.Height
      },
      Quality: v4l2ctl.Controls.CodecControls.video_bitrate.value ? 1 : 1,
      RateControl: {
        FrameRateLimit: cameraSettings.framerate,
        EncodingInterval: 1,
        BitrateLimit: v4l2ctl.Controls.CodecControls.video_bitrate.value / 1000
      },
      H264: {
        GovLength: v4l2ctl.Controls.CodecControls.h264_i_frame_period.value,
        H264Profile: v4l2ctl.Controls.CodecControls.h264_profile.desc
      },
      Multicast: {
        Address: {
          Type: "IPv4",
          IPv4Address: "0.0.0.0"
        },
        Port: 0,
        TTL: 1,
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

    var profile = {
      Name: "CurrentProfile",
      attributes: {
        token: "profile_token"
      },
      VideoSourceConfiguration: videoSourceConfiguration,
      VideoEncoderConfiguration: videoEncoderConfiguration,
      PTZConfiguration: this.ptz_service.ptzConfiguration
    };

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
      let rtspAddress = Utils.getIpAddress();
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
      var GetProfileResponse = { Profile: profile };
      return GetProfileResponse;
    };

    port.GetProfiles = (args) => {
      var GetProfilesResponse = { Profiles: [profile] };
      return GetProfilesResponse;
    };

    port.CreateProfile = (args) => {
      var CreateProfileResponse = { Profile: profile };
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
      var GetVideoEncoderConfigurationsResponse = { Configurations: [videoEncoderConfiguration] };
      return GetVideoEncoderConfigurationsResponse;
    };

    port.GetVideoEncoderConfiguration = (args) => {
      var GetVideoEncoderConfigurationResponse = { Configuration: videoEncoderConfiguration };
      return GetVideoEncoderConfigurationResponse;
    };

    port.SetVideoEncoderConfiguration = (args) => {
      var settings = {
        bitrate: args.Configuration.RateControl.BitrateLimit,
        framerate: args.Configuration.RateControl.FrameRateLimit,
        gop: args.Configuration.H264.GovLength,
        profile: args.Configuration.H264.H264Profile,
        quality: args.Configuration.Quality instanceof Object ? 1 : args.Configuration.Quality,
        resolution: args.Configuration.Resolution
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
        MediaUri: {
          Uri: "http://" + Utils.getIpAddress() + ":" + this.config.ServicePort + "/web/snapshot.jpg",
          InvalidAfterConnect: false,
          InvalidAfterReboot: false,
          Timeout: "PT30S"
        }
      };
      return GetSnapshotUriResponse;
    };

    port.GetAudioEncoderConfigurationOptions = (args) => {
      var GetAudioEncoderConfigurationOptionsResponse = { Options: [{}] };
      return GetAudioEncoderConfigurationOptionsResponse;
    };
  }
}