var fs = require("fs");
var config = require('../config');

var service = require('./stubs/media_service.js').MediaService;
var exports = module.exports = service;
var port = service.MediaService.Media;

var videoConfigurationOptions = {
  QualityRange : { Min : 5, Max : 5 },
  H264 : {
    ResolutionsAvailable : [{ Width : 1920, Height : 1080 }],
    GovLengthRange : { Min : 1, Max : 1 },
    FrameRateRange : { Min : 25, Max : 25 },
    EncodingIntervalRange : { Min : 1, Max : 1 },
    H264ProfilesSupported : ["Baseline"]
  }
};

var videoEncoderConfiguration = {
  Name : "VideoEncoderConfiguration",
  UseCount : 0,
  attributes : {
    token : "token"
  },
  Encoding : "H264",
  Resolution : { Width : 1920, Height : 1080 },
  Quality : 5,
  H264 : { GovLength : 1, H264Profile : "Baseline" },
  SessionTimeout : "1000"
};

var videoSourceConfiguration = {
  Name : "Primary Source",
  UseCount : 0,
  attributes : {
    token : "token"
  },
  SourceToken : "sourcetoken",
  Bounds : { attributes : { x : 0, y : 0, width : 1920, height : 1080 } }
};

var audioEncoderConfigurationOptions = {
  Options : []
};

var profile = {
  Name : "SynoTestProfile",
  attributes : {
    token : "token"
  },
  VideoSourceConfiguration : videoSourceConfiguration,
  VideoEncoderConfiguration : videoEncoderConfiguration
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
      Uri : "rtsp://" + config.IpAddress + ":" + config.RTSPPort + "/ " + config.RTSPName,
      InvalidAfterConnect : false,
      InvalidAfterReboot : false,
      Timeout : "PT30S"
    }
  };
  return GetStreamUriResponse;
};

port.GetProfile = function (args) {
  return { Profile : profile };
};

port.GetProfiles = function (args) {
  return { Profiles : [profile] };
};

port.CreateProfile = function (args) {
  return { Profile : profile };
};

port.DeleteProfile = function (args) {
  return {};
};

port.GetVideoSourceConfigurations = function (args) {
  return { Configurations : [videoSourceConfiguration] };
};

port.GetVideoEncoderConfigurations = function (args) {
  return { Configurations : [videoEncoderConfiguration] };
};

port.GetVideoEncoderConfiguration = function (args) {
  return { Configuration : [videoEncoderConfiguration] };
};

port.SetVideoEncoderConfiguration = function (args) {
  return { Configuration : [videoEncoderConfiguration] };
};

port.GetVideoEncoderConfigurationOptions = function (args) {
  return { Options : videoConfigurationOptions };
};

port.GetGuaranteedNumberOfVideoEncoderInstances = function (args) {
  return {
    TotalNumber : 1,
    H264 : 1
  }
};
port.GetSnapshotUri = function (args) {
  return {
    MediaUri : {
      Uri : "http://" + config.IpAddress + ":" + config.ServicePort + "/web/snapshot.jpg",
      Timeout : "PT30S",
      InvalidAfterConnect : false,
      InvalidAfterReboot : false
    }
  };
};

port.GetAudioEncoderConfigurationOptions = function (args) {
  return { Options : [{}] };
};