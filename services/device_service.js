///<reference path="../typings/tsd.d.ts" />
///<reference path="../typings/rpos/rpos.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var fs = require("fs");
var os = require('os');
var SoapService = require('../lib/SoapService');
var utils_1 = require('../lib/utils');
var DeviceService = (function (_super) {
    __extends(DeviceService, _super);
    function DeviceService(config, server) {
        _super.call(this, config, server);
        this.device_service = require('./stubs/device_service.js').DeviceService;
        this.serviceOptions = {
            path: '/onvif/device_service',
            services: this.device_service,
            xml: fs.readFileSync('./wsdl/device_service.wsdl', 'utf8'),
            wsdlPath: 'wsdl/device_service.wsdl',
            onReady: function () { return console.log('device_service started'); }
        };
        this.extendService();
    }
    DeviceService.prototype.extendService = function () {
        var _this = this;
        var port = this.device_service.DeviceService.Device;
        port.GetDeviceInformation = function (args) {
            var GetDeviceInformationResponse = {
                Manufacturer: _this.config.DeviceInformation.Manufacturer,
                Model: _this.config.DeviceInformation.Manufacturer,
                FirmwareVersion: _this.config.DeviceInformation.FirmwareVersion,
                SerialNumber: _this.config.DeviceInformation.SerialNumber,
                HardwareId: _this.config.DeviceInformation.HardwareId
            };
            return GetDeviceInformationResponse;
        };
        port.GetSystemDateAndTime = function (args) {
            var now = new Date();
            var GetSystemDateAndTimeResponse = {
                SystemDateAndTime: {
                    DateTimeType: "NTP",
                    DaylightSavings: now.dst(),
                    TimeZone: {
                        TZ: "CET-1CEST,M3.5.0,M10.5.0/3"
                    },
                    UTCDateTime: {
                        Date: { Day: now.getUTCDate(), Month: now.getUTCMonth() + 1, Year: now.getUTCFullYear() },
                        Time: { Hour: now.getUTCHours(), Minute: now.getUTCMinutes(), Second: now.getUTCSeconds() }
                    },
                    LocalDateTime: {
                        Date: { Day: now.getDate(), Month: now.getMonth() + 1, Year: now.getFullYear() },
                        Time: { Hour: now.getHours(), Minute: now.getMinutes(), Second: now.getSeconds() }
                    },
                    Extension: {}
                }
            };
            return GetSystemDateAndTimeResponse;
        };
        port.SystemReboot = function (args) {
            var SystemRebootResponse = {
                Message: utils_1.utils.execSync("sudo reboot")
            };
            return SystemRebootResponse;
        };
        port.GetCapabilities = function (args) {
            var category = args.Category;
            var GetCapabilitiesResponse = {
                Capabilities: {}
            };
            if (category == "All" || category == "Device") {
                GetCapabilitiesResponse.Capabilities = {
                    Device: {
                        XAddr: "http://" + (utils_1.utils.getIpAddress(_this.config.NetworkAdapter) || _this.config.IpAddress) + ":" + _this.config.ServicePort + "/onvif/device_service",
                        Network: {
                            IPFilter: false,
                            ZeroConfiguration: false,
                            IPVersion6: false,
                            DynDNS: false,
                            Extension: {
                                Dot11Configuration: false,
                                Extension: {}
                            }
                        },
                        System: {
                            DiscoveryResolve: false,
                            DiscoveryBye: false,
                            RemoteDiscovery: false,
                            SystemBackup: false,
                            SystemLogging: false,
                            FirmwareUpgrade: false,
                            SupportedVersions: {
                                Major: 2,
                                Minor: 5
                            },
                            Extension: {
                                HttpFirmwareUpgrade: false,
                                HttpSystemBackup: false,
                                HttpSystemLogging: false,
                                HttpSupportInformation: false,
                                Extension: {}
                            }
                        },
                        IO: {
                            InputConnectors: 0,
                            RelayOutputs: 0,
                            Extension: {
                                Auxiliary: false,
                                AuxiliaryCommands: "",
                                Extension: {}
                            }
                        },
                        Security: {
                            "TLS1.1": false,
                            "TLS1.2": false,
                            OnboardKeyGeneration: false,
                            AccessPolicyConfig: false,
                            "X.509Token": false,
                            SAMLToken: false,
                            KerberosToken: false,
                            RELToken: false,
                            Extension: {
                                "TLS1.0": false,
                                Extension: {}
                            }
                        },
                        Extension: {}
                    }
                };
            }
            if (category == "All" || category == "Device") {
                GetCapabilitiesResponse.Capabilities = {
                    Media: {
                        XAddr: "http://" + (utils_1.utils.getIpAddress(_this.config.NetworkAdapter) || _this.config.IpAddress) + ":" + _this.config.ServicePort + "/onvif/media_service",
                        StreamingCapabilities: {
                            RTPMulticast: false,
                            RTP_TCP: true,
                            RTP_RTSP_TCP: true,
                            Extension: {}
                        },
                        Extension: {
                            ProfileCapabilities: {
                                MaximumNumberOfProfiles: 1
                            }
                        }
                    }
                };
            }
            return GetCapabilitiesResponse;
        };
        port.GetHostname = function (args) {
            var GetHostnameResponse = {
                HostnameInformation: {
                    FromDHCP: false,
                    Name: os.hostname(),
                    Extension: {}
                }
            };
            return GetHostnameResponse;
        };
        port.SetHostname = function (args) {
            var SetHostnameResponse = {};
            return SetHostnameResponse;
        };
        port.SetHostnameFromDHCP = function (args) {
            var SetHostnameFromDHCPResponse = {
                RebootNeeded: false
            };
            return SetHostnameFromDHCPResponse;
        };
        port.GetServiceCapabilities = function (args) {
            var GetServiceCapabilitiesResponse = {
                Capabilities: {
                    Network: {
                        attributes: {
                            IPFilter: false,
                            ZeroConfiguration: false,
                            IPVersion6: false,
                            DynDNS: false,
                            Dot11Configuration: false,
                            Dot1XConfigurations: 0,
                            HostnameFromDHCP: false,
                            NTP: 0,
                            DHCPv6: false
                        }
                    },
                    Security: {
                        attributes: {
                            "TLS1.0": false,
                            "TLS1.1": false,
                            "TLS1.2": false,
                            OnboardKeyGeneration: false,
                            AccessPolicyConfig: false,
                            DefaultAccessPolicy: false,
                            Dot1X: false,
                            RemoteUserHandling: false,
                            "X.509Token": false,
                            SAMLToken: false,
                            KerberosToken: false,
                            UsernameToken: false,
                            HttpDigest: false,
                            RELToken: false,
                            SupportedEAPMethods: 0,
                            MaxUsers: 1,
                            MaxUserNameLength: 10,
                            MaxPasswordLength: 256
                        }
                    },
                    System: {
                        attributes: {
                            DiscoveryResolve: false,
                            DiscoveryBye: false,
                            RemoteDiscovery: false,
                            SystemBackup: false,
                            SystemLogging: false,
                            FirmwareUpgrade: false,
                            HttpFirmwareUpgrade: false,
                            HttpSystemBackup: false,
                            HttpSystemLogging: false,
                            HttpSupportInformation: false,
                            StorageConfiguration: false
                        }
                    },
                }
            };
            return GetServiceCapabilitiesResponse;
        };
        port.GetNTP = function (args) {
            var GetNTPResponse = {};
            return GetNTPResponse;
        };
        port.SetNTP = function (args) {
            var SetNTPResponse = {};
            return SetNTPResponse;
        };
        port.GetNetworkInterfaces = function (args) {
            var GetNetworkInterfacesResponse = {
                NetworkInterfaces: []
            };
            var nwifs = os.networkInterfaces();
            for (var nwif in nwifs) {
                GetNetworkInterfacesResponse.NetworkInterfaces.push({
                    attributes: {
                        token: nwif
                    }
                });
            }
            return GetNetworkInterfacesResponse;
        };
        port.GetNetworkProtocols = function (args) {
            var GetNetworkProtocolsResponse = {
                NetworkProtocols: [{
                        Name: "RTSP",
                        Enabled: true,
                        Port: _this.config.RTSPPort
                    }]
            };
            return GetNetworkProtocolsResponse;
        };
        port.GetRelayOutputs = function (args) {
            var GetRelayOutputsResponse = {};
            return GetRelayOutputsResponse;
        };
    };
    return DeviceService;
})(SoapService);
module.exports = DeviceService;
//# sourceMappingURL=device_service.js.map