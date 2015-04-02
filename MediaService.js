var fs = require("fs");
var Config = require('./config').Config;

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

var MediaService = {
    wsdl : fs.readFileSync('wsdl/media_service.wsdl', 'utf8'),
    MediaService: {
        Media: {
            GetServiceCapabilities: function (args) {
                return {
                    Capabilities : {
                        OSD : false,
                        Rotation : false,
                        SnapshotUri : true,
                        VideoSourceMode : false,
                        ProfileCapabilities : {
                            //MaximumNumberOfProfiles : 1
                        },
                        StreamingCapabilities : {
                            RTPMulticast : false,
                            RTP_TCP : true,
                            RTP_RTSP_TCP : true,
                            NoRTSPStreaming : false,
                            NonAggregateControl : false,
                        },
                    }
                };
            },
            
            GetStreamUri : function (args) {
                return {
                    MediaUri : {
                        Uri : "rtsp://" + Config.IpAddress + ":" + Config.RTSPPort + Config.RTSPName,
                        InvalidAfterConnect : false,
                        InvalidAfterReboot : false
                    }
                };
            },
            
            GetProfile : function (args) {
                return { Profile : profile };
            },
            
            GetProfiles : function (args) {
                return { Profiles : [profile] };
            },
            
            CreateProfile : function (args) {
                return { Profile : profile };
            },
            
            DeleteProfile : function (args) {
                return {};
            },
            
            GetVideoSourceConfigurations : function (args) {
                return { Configurations : [videoSourceConfiguration] };
            },
            
            GetVideoEncoderConfigurations : function (args) {
                return { Configurations : [videoEncoderConfiguration] };
            },
            
            GetVideoEncoderConfiguration : function (args) {
                return { Configuration : [videoEncoderConfiguration] };
            },
            
            SetVideoEncoderConfiguration : function (args) {
                return { Configuration : [videoEncoderConfiguration] };
            },
            
            GetVideoEncoderConfigurationOptions : function (args) {
                return { Options : videoConfigurationOptions };
            },
            
            GetGuaranteedNumberOfVideoEncoderInstances : function (args) {
                return {
                    TotalNumber : 1,
                    H264 : 1
                }
            },
            GetSnapshotUri : function (args) {
                return {
                    MediaUri : {
                        Uri : "http://" + Config.IpAddress + ":" + Config.ServicePort + "/web/snapshot.jpg",
                        Timeout : "PT30S",
                        InvalidAfterConnect : false,
                        InvalidAfterReboot : false
                    }
                };
            },
            
            GetAudioEncoderConfigurationOptions : function (args) {
                return { Options : [{}] };
            }
        }
    }
};

exports.MediaService = MediaService;