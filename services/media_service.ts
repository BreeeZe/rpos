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
  profilesArray: Profile[];

  constructor(config: rposConfig, server: Server, camera: Camera, ptz_service: PTZService, profilesArray: Profile[]) {
    super(config, server);
    this.media_service = require('./stubs/media_service.js').MediaService;

    this.camera = camera;
    this.ptz_service = ptz_service;
    this.profilesArray = profilesArray;
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

  saveProfiles() {
    let output = [];
    this.profilesArray.map(item => {
      if (item.attributes.fixed == false) {
        let newItem = {};
        newItem['name'] = item.Name;
        newItem['token'] = item.attributes.token;
        newItem['videoSourceConfigurationToken'] = (item.VideoSourceConfiguration != null ? item.VideoSourceConfiguration.attributes.token : '');
        newItem['videoEncoderConfigurationToken'] = (item.VideoEncoderConfiguration != null ? item.VideoEncoderConfiguration.attributes.token : '');
        newItem['ptzConfigurationToken'] = (item.PTZConfiguration != null ? item.PTZConfiguration.attributes.token : '');
        output.push(newItem);
      }
    });
    fs.writeFileSync('userProfiles.json', JSON.stringify(output));
  }



  starting() {
    var listeners = this.webserver.listeners('request').slice();
    this.webserver.removeAllListeners('request');
    this.webserver.addListener('request', (request, response, next) => {
      utils.log.debug('web request received : %s', request.url);

      let uri = url.parse(request.url, true);
      let action = uri.pathname;
      if (action == '/web/snapshot.jpg') {
        /*
        // Open a TCP connection to the encoder board and request a JPEG
        let net = require('net');

        let client = new net.Socket();
        client.connect(50013, '192.168.2.224', function () {
          console.log('JPEG Server Connected');
          client.write('640;480;50');
        });

        client.on('data', function (data) {
          console.log('Received: ' + data);
          client.destroy(); // kill client after server's response
        });

        client.on('close', function () {
          console.log('Connection closed');
        });


        // this.deliver_jpg(response); // response.Write() and response.End()
        */

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

    var cameraOptions = this.camera.options;
    var cameraSettings = this.camera.settings;
    var camera = this.camera;

    let _profilesArray = this.profilesArray;

    var h264Profiles = v4l2ctl.Controls.CodecControls.h264_profile.getLookupSet().map(ls=>ls.desc);
    h264Profiles.splice(1, 1);

    // Video Configuration Options. Either take values from V4L2 or use Hardcoded values.
    let videoConfigurationOptions = {
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


    ///////////////////////////////////////////////////////
    // Video Encoder configuration
    // Create one Encoder Config per Camera
    //////////////////////////////////////////////////////
    var videoEncoderConfigurationsArray = []

    for (let i = 1; i <= this.config.Cameras.length; i++) {
      let newItem =
      {
      attributes: {
          token: `encoder_config_token_${i.toString().padStart(2, '0')}` // breaking change. encoder_config_token is now encoder_config_token_01
      },
        Name: `Video Encoder Configuration ${i}`,
        UseCount: 1,
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
        TTL:  1,
        AutoStart: false
      },
      SessionTimeout: "PT1000S"
    };

      videoEncoderConfigurationsArray.push(newItem)
    }


    ////////////////////////////////////////////////
    // VideoSource is a Lens, or an Encoder Input
    // Note: Does not have a "name" value. Looks to have been forgotten in the ONVIF Standard which is unfortunate as Analogue Encoders have lots of Sources
    ////////////////////////////////////////////////
    var videoSourcesArray: VideoSource[] = []

    for (let i = 1; i <= this.config.Cameras.length; i++) {

      let newItem: VideoSource = {
      attributes: {
          token: `video_src_token_${i.toString().padStart(2, '0')}` // breaking change. token renamed from video_src_token to video_src_token_01 for first item
      },
      Framerate: 25,
      Resolution: { Width: 1920, Height: 1280 }
    };

      videoSourcesArray.push(newItem);
    }


    ///////////////////////////////////////////////////////
    // VideoSourceConfiguration
    // allows for cropping of the image
    // Links through to the Video Source Token
    ///////////////////////////////////////////////////////
    var videoSourceConfigurationsArray: VideoSourceConfiguration[] = [];

    for (let i = 1; i <= this.config.Cameras.length; i++) {

      let newItem: VideoSourceConfiguration = {
        Name: `Video Source Configuration ${i.toString()}`,
        UseCount: 1,
      attributes: {
        token: `video_src_config_token_${i.toString().padStart(2, '0')}`
      },
        SourceToken: `video_src_token_${i.toString().padStart(2, '0')}`,
      Bounds: { attributes: { x: 0, y: 0, width: 1920, height: 1080 } }
    };

      videoSourceConfigurationsArray.push(newItem);
    }



    //////////////////////////////////////////////////////
    // A Profile connects
    //    The VideoSourceConfiguration (and it's VideoSource),
    //    The EncoderConfiguration
    //    The PTZConfiguration (and it's PTZ node)
    // The user can also create profiles and give them their own name
    //////////////////////////////////////////////////////

    // Autogeneate the default Profiles. These have fixed: true and cannot be changed or deleted. VMS created profiles can be added/changed/deleted

    for (let i = 1; i <= this.config.Cameras.length; i++) {

      let newItem: Profile = {
        Name: `Cam ${i}`,
      attributes: {
        token: `profile_token_${i.toString().padStart(2, '0')}`,
        fixed: true
      },
        VideoSourceConfiguration: videoSourceConfigurationsArray[i - 1],
        VideoEncoderConfiguration: videoEncoderConfigurationsArray[i - 1],
        PTZConfiguration: this.ptz_service.ptzConfigurationsArray[i - 1]
    };

      _profilesArray.push(newItem);
    }

    //
    // ADD USER DEFINED PROFILESfrom the JSON file
    // JSON file stores the token names, so find those tokens from the Array of Configuration Objects
    try {
      if (fs.existsSync('userProfiles.json')) {
        const raw = fs.readFileSync('userProfiles.json', 'utf-8');
        const data: SavedProfile[] = JSON.parse(raw);

        for (const userProfile of data) {
          let newItem: Profile = {
            Name: userProfile.name,
            attributes: { token: userProfile.token, fixed: false },
            VideoSourceConfiguration: (userProfile.videoSourceConfigurationToken != '' ? videoSourceConfigurationsArray.find(item => item.attributes.token == userProfile.videoSourceConfigurationToken) : undefined),
            VideoEncoderConfiguration: (userProfile.videoEncoderConfigurationToken != '' ? videoEncoderConfigurationsArray.find(item => item.attributes.token == userProfile.videoEncoderConfigurationToken) : undefined),
            PTZConfiguration: (userProfile.videoEncoderConfigurationToken != '' ? this.ptz_service.ptzConfigurationsArray.find(item => item.attributes.token == userProfile.ptzConfigurationToken) : undefined)
          }
          utils.log.info("Adding User Defined ONVIF Profile " + userProfile.name);
          _profilesArray.push(newItem);
        }
      }

    } catch (e) {
      utils.log.error('Could not load User Defined ONVIF Profiles');
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
              MaximumNumberOfProfiles: 32 // allow for user created profiles
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

      // Check value of 'args.ProfileToken to find out which RTSP Stream we want
      // Check value of 'args.StreamSetup' for unicast/TCP/multicast details


      // Check the value of args.ProfileToken
      // Get the Profile from the ProfilesArray
      // Examine the Video Source / Video Encoder
      // Generate the suitable RTSP string

      const profileToken: String = args.ProfileToken;
      const profile = _profilesArray.find(item => item.attributes.token == profileToken);

      if (profile == null || profile == undefined) {
        // Error. Profile invalid
        let GetStreamUriResponse = {} // TODO Add error 
        return GetStreamUriResponse;
      }

      // Each VideoEncoder has a RTSP URL associated with it
      const videoEncoderConfigrationToken = profile.VideoEncoderConfiguration.attributes.token;

      const videoEncoderConfiguration = videoEncoderConfigurationsArray.find(item => item.attributes.token == videoEncoderConfigrationToken);

      if (videoEncoderConfiguration == null || videoEncoderConfiguration == undefined) {
        // Error. Cannot find videoEncoderConfiguration
        let GetStreamUriResponse = {} // TODO Add error 
        return GetStreamUriResponse;
      }

      // Get the Index (trim "encoder_config_token_")
      const index = Number(videoEncoderConfigrationToken.substring(21)) - 1; // -1 because array is Zero based but configs start from 1


      //Use the Index to look into the CameraArray


      let rtspAddress = utils.getIpAddress();
      if (this.config.Cameras[index].RTSPAddress.length > 0) rtspAddress = this.config.Cameras[index].RTSPAddress;

      let GetStreamUriResponse = {
        MediaUri: {
          Uri: (args.StreamSetup.Stream == "RTP-Multicast" && this.config.Cameras[index].MulticastEnabled ?
            `rtsp://${rtspAddress}:${this.config.Cameras[index].RTSPPort}/${this.config.Cameras[index].RTSPMulticastName}` :
            `rtsp://${rtspAddress}:${this.config.Cameras[index].RTSPPort}/${this.config.Cameras[index].RTSPName}`),
          InvalidAfterConnect: false,
          InvalidAfterReboot: false,
          Timeout: "PT30S"
        }
      };
      return GetStreamUriResponse;
    };

    port.GetProfile = (args) => {
      let profile = _profilesArray.find(item => item.attributes.token == args.ProfileToken);
      let GetProfileResponse = { Profile: profile };
      return GetProfileResponse;
    };

    port.GetProfiles = (args) => {
      let GetProfilesResponse = { Profiles: _profilesArray };
      return GetProfilesResponse;
    };

    port.CreateProfile = (args) => {

      // We are passed the new Profile's name
      // Generate a token ID and ensure it is unique
      let newTokenID = new Date().getTime().toString();
      while (_profilesArray.findIndex(item => item.attributes.token == newTokenID) >= 0) {
        // if already in use (eg 2 Creates within 1ms) add '0's on the end until it is unique
        newTokenID = newTokenID + '0';
      }
      let newProfile: Profile = {
        Name: args.Name,
        attributes: {
          token: newTokenID,
          fixed: false
        }//,
        //VideoSourceConfiguration: null,    // The JSOB Object to XML converter requires thee fields to be absent (undefined) if they are not set. Do not set them to NULL
        //VideoEncoderConfiguration: null,
        //PTZConfiguration: null
      };

      _profilesArray.push(newProfile);

      // Save all the user defined profiles to a .JSON file
      this.saveProfiles();

      let CreateProfileResponse = {
        Profile: {
          Name: args.Name,
          attributes: {
            token: newTokenID
          }
        }
      };
      return CreateProfileResponse;
    };

    port.DeleteProfile = (args) => {
      // cannot delete 'fixed' profiles
      let profileIndex = _profilesArray.findIndex(item => item.attributes.token == args.ProfileToken);

      if (profileIndex >= 0 && _profilesArray[profileIndex].attributes.fixed == false) {
        // remove item at profileIndex
        _profilesArray.splice(profileIndex, 1); // remove 1 item from position 'profileIndex'
      }

      // add error results

      this.saveProfiles();

      let DeleteProfileResponse = {};
      return DeleteProfileResponse;
    };

    port.GetVideoSources = (args) => {
      let GetVideoSourcesResponse = { VideoSources: videoSourcesArray };
        return GetVideoSourcesResponse;
    }

    port.GetVideoSourceConfigurations = (args) => {
      let GetVideoSourceConfigurationsResponse = { Configurations: videoSourceConfigurationsArray };
      return GetVideoSourceConfigurationsResponse;
    };

    port.GetVideoSourceConfiguration = (args) => {
      let configuration = videoSourceConfigurationsArray.find(item => item.attributes.token == args.ConfigurationToken);
      let GetVideoSourceConfigurationResponse = { Configurations: configuration };
        return GetVideoSourceConfigurationResponse;
    };

    port.GetVideoEncoderConfigurations = (args) => {
      let GetVideoEncoderConfigurationsResponse = { Configurations: videoEncoderConfigurationsArray };
      return GetVideoEncoderConfigurationsResponse;
    };

    port.GetVideoEncoderConfiguration = (args) => {
      let configuration = videoEncoderConfigurationsArray.find(item => item.attributes.token == args.token)
      let GetVideoEncoderConfigurationResponse = { Configuration: configuration };
      return GetVideoEncoderConfigurationResponse;
    };

    port.SetVideoEncoderConfiguration = (args) => {
      /*
      var settings = {
        bitrate: args.Configuration.RateControl.BitrateLimit,
        framerate: args.Configuration.RateControl.FrameRateLimit,
        gop: args.Configuration.H264.GovLength,
        profile: args.Configuration.H264.H264Profile,
        quality: args.Configuration.Quality instanceof Object ? 1 : args.Configuration.Quality,
        resolution: args.Configuration.Resolution
      };
      camera.setSettings(settings);
      */

      // Update the Array and push to the camera
      let index = videoEncoderConfigurationsArray.findIndex(item => item.attributes.token == args.Configuration.attributes.token);

      if (index >= 0) {
        videoEncoderConfigurationsArray[index].Encoding = args.Configuration.Encoding;
        videoEncoderConfigurationsArray[index].H264 = args.Configuration.H264;
        videoEncoderConfigurationsArray[index].Multicast = args.Configuration.Multicast;
        videoEncoderConfigurationsArray[index].Quality = args.Configuration.Quality;
        videoEncoderConfigurationsArray[index].RateControl = args.Configuration.RateControl;
        videoEncoderConfigurationsArray[index].Resolution = args.Configuration.Resolution;
      }
      let SetVideoEncoderConfigurationResponse = {};
      return SetVideoEncoderConfigurationResponse;
    };

    port.GetVideoEncoderConfigurationOptions = (args) => {
      let GetVideoEncoderConfigurationOptionsResponse = { Options: videoConfigurationOptions };
      return GetVideoEncoderConfigurationOptionsResponse;
    };

    port.GetGuaranteedNumberOfVideoEncoderInstances = (args) => {
      var GetGuaranteedNumberOfVideoEncoderInstancesResponse = {
        TotalNumber: 16,
        H264: 16
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


    port.AddVideoSourceConfiguration = (args) => {
      // pass in ProfileToken and ConfigurationToken
      let profile = _profilesArray.find(item => item.attributes.token == args.ProfileToken);
      let configuration = videoSourceConfigurationsArray.find(item => item.attributes.token == args.ConfigurationToken)

      profile.VideoSourceConfiguration = configuration;

      this.saveProfiles();

      let AddVideoSourceConfigurationResponse = {};
      return AddVideoSourceConfigurationResponse;
    };


    port.AddVideoEncoderConfiguration = (args) => {
      // pass in ProfileToken and ConfigurationToken
      let profile = _profilesArray.find(item => item.attributes.token == args.ProfileToken);
      let configuration = videoEncoderConfigurationsArray.find(item => item.attributes.token == args.ConfigurationToken)

      profile.VideoEncoderConfiguration = configuration;

      this.saveProfiles();

      let AddVideoEncoderConfigurationResponse = {};
      return AddVideoEncoderConfigurationResponse;
    };

    port.AddPTZConfiguration = (args) => {
      // pass in ProfileToken and ConfigurationToken
      let profile = _profilesArray.find(item => item.attributes.token == args.ProfileToken);
      let configuration = this.ptz_service.ptzConfigurationsArray.find(item => item.attributes.token == args.ConfigurationToken)

      profile.PTZConfiguration = configuration;

      this.saveProfiles();

      let AddPTZConfigurationResponse = {};
      return AddPTZConfigurationResponse;
    }

    // Get the encoder configurations that are compatible to the Profile parameter
    // If there is a VideoSource already configured on the Profile, it
    // may limit which Encoder Configurations we can return (eg if particular Encoder DSP
    // is physically wired to a Video Sources like a lens or an analogue encoder input)
    port.GetCompatibleVideoEncoderConfigurations = (args) => {

      // TODO - check the arg Profile is in the Profiles list
      // return all encoders for now but a different project may have restrictions


      let GetCompatibleVideoEncoderConfigurationsResponse = {
        Configurations: videoEncoderConfigurationsArray // TODO. Could filter this list
      }
      return GetCompatibleVideoEncoderConfigurationsResponse;
    };


    port.GetCompatibleMetadataConfigurations = (args) => {
      let GetCompatibleMetadataConfigurationsResponse = {};
      return GetCompatibleMetadataConfigurationsResponse;
    }
  }
}
export = MediaService;
