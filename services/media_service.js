var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
///<reference path="../typings/tsd.d.ts" />
///<reference path="../typings/rpos/rpos.d.ts" />
var fs = require("fs");
var SoapService = require('../lib/SoapService');
var utils_1 = require('../lib/utils');
var url = require('url');
var utils = utils_1.Utils.utils;
var MediaService = (function (_super) {
    __extends(MediaService, _super);
    function MediaService(config, server, camera) {
        _super.call(this, config, server);
        this.media_service = require('./stubs/media_service.js').MediaService;
        this.camera = camera;
        this.serviceOptions = {
            path: '/onvif/media_service',
            services: this.media_service,
            xml: fs.readFileSync('./wsdl/media_service.wsdl', 'utf8'),
            wsdlPath: 'wsdl/media_service.wsdl',
            onReady: function () {
                utils.log.info('media_service started');
            }
        };
    }
    MediaService.prototype.starting = function () {
        var _this = this;
        var listeners = this.webserver.listeners('request').slice();
        this.webserver.removeAllListeners('request');
        this.webserver.addListener('request', function (request, response, next) {
            utils.log.debug('web request received : %s', request.url);
            var uri = url.parse(request.url, true);
            var action = uri.pathname;
            if (action == '/web/snapshot.jpg') {
                try {
                    var img = fs.readFileSync('/dev/shm/snapshot.jpg');
                    response.writeHead(200, { 'Content-Type': 'image/jpg' });
                    response.end(img, 'binary');
                }
                catch (err) {
                    utils.log.error("Error opening snapshot : %s", err);
                    response.end("404: Not Found: " + request);
                }
            }
            else {
                for (var i = 0, len = listeners.length; i < len; i++) {
                    listeners[i].call(_this, request, response, next);
                }
            }
        });
    };
    ;
    MediaService.prototype.started = function () {
        this.camera.startRtsp();
    };
    ;
    MediaService.prototype.extendService = function () {
        var _this = this;
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
        port.GetServiceCapabilities = function (args) {
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
        port.GetStreamUri = function (args) {
            var GetStreamUriResponse = {
                MediaUri: {
                    Uri: "rtsp://" + utils.getIpAddress() + ":" + _this.config.RTSPPort + "/" + _this.config.RTSPName,
                    InvalidAfterConnect: false,
                    InvalidAfterReboot: false,
                    Timeout: "PT30S"
                }
            };
            return GetStreamUriResponse;
        };
        port.GetProfile = function (args) {
            var GetProfileResponse = { Profile: profile };
            return GetProfileResponse;
        };
        port.GetProfiles = function (args) {
            var GetProfilesResponse = { Profiles: [profile] };
            return GetProfilesResponse;
        };
        port.CreateProfile = function (args) {
            var CreateProfileResponse = { Profile: profile };
            return CreateProfileResponse;
        };
        port.DeleteProfile = function (args) {
            var DeleteProfileResponse = {};
            return DeleteProfileResponse;
        };
        port.GetVideoSourceConfigurations = function (args) {
            var GetVideoSourceConfigurationsResponse = { Configurations: [videoSourceConfiguration] };
            return GetVideoSourceConfigurationsResponse;
        };
        port.GetVideoEncoderConfigurations = function (args) {
            var GetVideoEncoderConfigurationsResponse = { Configurations: [videoEncoderConfiguration] };
            return GetVideoEncoderConfigurationsResponse;
        };
        port.GetVideoEncoderConfiguration = function (args) {
            var GetVideoEncoderConfigurationResponse = { Configuration: videoEncoderConfiguration };
            return GetVideoEncoderConfigurationResponse;
        };
        port.SetVideoEncoderConfiguration = function (args) {
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
        port.GetVideoEncoderConfigurationOptions = function (args) {
            var GetVideoEncoderConfigurationOptionsResponse = { Options: videoConfigurationOptions };
            return GetVideoEncoderConfigurationOptionsResponse;
        };
        port.GetGuaranteedNumberOfVideoEncoderInstances = function (args) {
            var GetGuaranteedNumberOfVideoEncoderInstancesResponse = {
                TotalNumber: 1,
                H264: 1
            };
            return GetGuaranteedNumberOfVideoEncoderInstancesResponse;
        };
        port.GetSnapshotUri = function (args) {
            var GetSnapshotUriResponse = {};
            return GetSnapshotUriResponse;
        };
        port.GetAudioEncoderConfigurationOptions = function (args) {
            var GetAudioEncoderConfigurationOptionsResponse = { Options: [{}] };
            return GetAudioEncoderConfigurationOptionsResponse;
        };
    };
    return MediaService;
})(SoapService);
module.exports = MediaService;
//# sourceMappingURL=media_service.js.map