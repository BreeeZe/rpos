var fs = require("fs");
var config = require('../config');

var service = require('./stubs/media_service.js').MediaService;
var exports = module.exports = {
  service : service,
  camera : null
};
var port = service.MediaService.Media;

var videoConfigurationOptions = function () {
  var cameraOptions = exports.camera.options;
  var o = {
    QualityRange : {
      Min : cameraOptions.quality[0], 
      Max : cameraOptions.quality[cameraOptions.quality.length - 1]
    },
    H264 : {
      ResolutionsAvailable : cameraOptions.resolutions,
      GovLengthRange : { Min : 1, Max : 10 },
      FrameRateRange : {
        Min : cameraOptions.framerates[0], 
        Max : cameraOptions.framerates[cameraOptions.framerates.length - 1]
      },
      EncodingIntervalRange : { Min : 1, Max : 1 },
      H264ProfilesSupported : cameraOptions.profiles
    },
    Extension : {
      H264 : {
        ResolutionsAvailable : cameraOptions.resolutions,
        GovLengthRange : { Min : 1, Max : 10 },
        FrameRateRange : {
          Min : cameraOptions.framerates[0], 
          Max : cameraOptions.framerates[cameraOptions.framerates.length - 1]
        },
        EncodingIntervalRange : { Min : 1, Max : 1 },
        H264ProfilesSupported : cameraOptions.profiles,    
        BitrateRange : {
          Min : cameraOptions.bitrates[0],
          Max : cameraOptions.bitrates[cameraOptions.bitrates.length - 1]
        }
      }
    }
  }
  return o;
};



var videoEncoderConfiguration = function () {
  var cameraSettings = exports.camera.settings;
  var Configuration = {
    attributes : {
      token : "token"
    },
    Name : "PiCameraConfiguration",
    UseCount : 0,
    Encoding : "H264",
    Resolution : {
      Width : cameraSettings.resolution.Width,
      Height : cameraSettings.resolution.Height
    },
    Quality : cameraSettings.bitrate ? null : cameraSettings.quality,
    RateControl : {
      FrameRateLimit : cameraSettings.framerate,
      EncodingInterval : 1,
      BitrateLimit : cameraSettings.bitrate
    },
    H264 : {
      GovLength : cameraSettings.gop,
      H264Profile : cameraSettings.profile
    },
    SessionTimeout : "1000"
  };
  return Configuration;
};


var videoSourceConfiguration = {
  Name : "Primary Source",
  UseCount : 0,
  attributes : {
    token : "token"
  },
  SourceToken : [],
  Bounds : { attributes : { x : 0, y : 0, width : 1920, height : 1080 } }
};

var audioEncoderConfigurationOptions = {
  Options : []
};

var profile = function () {
  return {
    Name : "SynoTestProfile",
    attributes : {
      token : "token"
    },
    VideoSourceConfiguration : videoSourceConfiguration,
    VideoEncoderConfiguration : videoEncoderConfiguration()
  };
};

port.GetServiceCapabilities = function (args /*, cb, headers*/) {
  var GetServiceCapabilitiesResponse = {
    Capabilities : {
      attributes : {
        SnapshotUri : true,
        Rotation : false,
        VideoSourceMode : false,
        OSD : false
      },
      ProfileCapabilities : {
        attributes : {
          MaximumNumberOfProfiles : 1
        }
      },
      StreamingCapabilities : {
        attributes : {
          RTPMulticast : false,
          RTP_TCP : true,
          RTP_RTSP_TCP : true,
          NonAggregateControl : false,
          NoRTSPStreaming : false
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
port.GetStreamUri = function (args /*, cb, headers*/) {
  var GetStreamUriResponse = {
    MediaUri : {
      Uri : "rtsp://" + config.IpAddress + ":" + config.RTSPPort + "/" + config.RTSPName,
      InvalidAfterConnect : false,
      InvalidAfterReboot : false,
      Timeout : "PT30S"
    }
  };
  return GetStreamUriResponse;
};

port.GetProfile = function (args) {
  var GetProfileResponse = { Profile : profile() };
  return GetProfileResponse;
};

port.GetProfiles = function (args) {
  var GetProfilesResponse = { Profiles : [profile()] };
  return GetProfilesResponse;
};

port.CreateProfile = function (args) {
  var CreateProfileResponse = { Profile : profile() };
  return CreateProfileResponse;
};

port.DeleteProfile = function (args) {
  var DeleteProfileResponse = {};
  return DeleteProfileResponse;
};

port.GetVideoSourceConfigurations = function (args) {
  var GetVideoSourceConfigurationsResponse = { Configurations : [videoSourceConfiguration] };
  return GetVideoSourceConfigurationsResponse;
};

port.GetVideoEncoderConfigurations = function (args) {
  var GetVideoEncoderConfigurationsResponse = { Configurations : [videoEncoderConfiguration()] };
  return GetVideoEncoderConfigurationsResponse;
};

port.GetVideoEncoderConfiguration = function (args) {
  var GetVideoEncoderConfigurationResponse = { Configuration : [videoEncoderConfiguration()] };
  return GetVideoEncoderConfigurationResponse;
};

port.SetVideoEncoderConfiguration = function (args) {
  var cameraSettings = exports.camera.settings;
  cameraSettings.bitrate = args.Configuration.RateControl.BitrateLimit;
  cameraSettings.framerate = args.Configuration.RateControl.FrameRateLimit;
  cameraSettings.gop = args.Configuration.H264.GovLength;
  cameraSettings.profile = args.Configuration.H264.H264Profile;
  cameraSettings.quality = args.Configuration.Quality instanceof Object ? null : args.Configuration.Quality;
  cameraSettings.resolution = args.Configuration.Resolution;
  exports.camera.startAll();
  
  var SetVideoEncoderConfigurationResponse = {};
  return SetVideoEncoderConfigurationResponse;
};

port.GetVideoEncoderConfigurationOptions = function (args) {
  var GetVideoEncoderConfigurationOptionsResponse = { Options : videoConfigurationOptions() };
  return GetVideoEncoderConfigurationOptionsResponse;
};

port.GetGuaranteedNumberOfVideoEncoderInstances = function (args) {
  var GetGuaranteedNumberOfVideoEncoderInstancesResponse = {
    TotalNumber : 1,
    H264 : 1
  }
  return GetGuaranteedNumberOfVideoEncoderInstancesResponse;
};
port.GetSnapshotUri = function (args) {
  var GetSnapshotUriResponse = {
    MediaUri : {
      Uri : "http://" + config.IpAddress + ":" + config.ServicePort + "/web/snapshot.jpg",
      Timeout : "PT30S",
      InvalidAfterConnect : false,
      InvalidAfterReboot : false
    }
  };
  return GetSnapshotUriResponse;
};

port.GetAudioEncoderConfigurationOptions = function (args) {
  var GetAudioEncoderConfigurationOptionsResponse = { Options : [{}] };
  return GetAudioEncoderConfigurationOptionsResponse;
};