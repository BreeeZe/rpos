require("../lib/utils");
var fs = require("fs");

var config = require('../config');
var exports = module.exports= {
 DeviceService : {
    DeviceService: {
        Device: {
            GetCapabilities: function (args) {
                return {
                    Capabilities : {
                        Media : {
                            XAddr : "http://" + config.IpAddress + ":" + config.ServicePort + "/onvif/media_service"
                        },
                        Device : {
                            XAddr : "http://" + config.IpAddress + ":" + config.ServicePort + "/onvif/device_service"
                        }
                    }
                };
            },
            GetDeviceInformation: function (args) {
                return config.DeviceInformation;
            },
            
            GetSystemDateAndTime : function () {
                var now = new Date();
                return {
                    DateTimeType : "NTP",
                    DaylightSavings : now.dst(),
                    LocalDateTime : {
                        Date : { Day : now.getDate() , Month : now.getMonth() + 1 , Year : now.getFullYear() },
                        Time : { Hour : now.getHours(), Minute : now.getMinutes() , Second : now.getSeconds() }
                    },
                    UTCDateTime : {
                        Date : { Day : now.getUTCDate() , Month : now.getUTCMonth() + 1, Year : now.getUTCFullYear() },
                        Time : { Hour : now.getUTCHours(), Minute : now.getUTCMinutes() , Second : now.getUTCSeconds() }
                    }
                //,TimeZone : {
                //    TZ : "GMT"
                //}
                };
            },
            
            GetNTP : function () {
                return {
                    FromDHCP : false,
                    NTPFromDHCP : [],
                    NTPManual : [{ DNSname : "time.nist.gov", Type : "DNS" }]
                };
            },
            
            SetNTP : function (args) {
                return {};
            },
            
            GetNetworkInterfaces : function () {
                return {
                    NetworkInterfaces : [{
                            attributes : { token: "token" },
                            Enabled : true
                        }]
                };
            },
            
            GetNetworkProtocols : function () {
                return {
                    NetworkProtocols : [{
                            Name : "RTSP", Enabled : true, Port : [config.RTSPPort]
                        }]
                };
            },
            GetRelayOutputs : function () {
                return { };
            }
        }
    },
    wsdl : fs.readFileSync('wsdl/device_service.wsdl', 'utf8')
};

}