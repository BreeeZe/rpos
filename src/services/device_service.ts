import { SoapService } from "../lib/SoapService";
import { Utils } from '../lib/utils';
import { Server } from 'http';
import { RposConfig } from "../lib/config";
import { readFileSync } from "fs";
import { hostname, networkInterfaces } from "os";
import { subnet } from "ip";

export class DeviceService extends SoapService {
  device_service: any;
  callback: any;

  constructor(config: RposConfig, server: Server, callback) {
    super(config, server);

    this.device_service = require('./stubs/device_service.js').DeviceService;
    this.callback = callback;

    this.serviceOptions = {
      path: '/onvif/device_service',
      services: this.device_service,
      xml: readFileSync('./wsdl/device_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/device_service.wsdl',
      onReady: () => console.log('device_service started')
    };

    this.extendService();
  }

  extendService() {
    var port = this.device_service.DeviceService.Device;

    port.GetDeviceInformation = (args /*, cb, headers*/) => {
      var GetDeviceInformationResponse = {
        Manufacturer: this.config.DeviceInformation.Manufacturer,
        Model: this.config.DeviceInformation.Model,
        FirmwareVersion: this.config.DeviceInformation.FirmwareVersion,
        SerialNumber: this.config.DeviceInformation.SerialNumber,
        HardwareId: this.config.DeviceInformation.HardwareId
      };
      return GetDeviceInformationResponse;
    };

    port.GetSystemDateAndTime = (args /*, cb, headers*/) => {
      var now = new Date();

      // Ideally this code would compute a full POSIX TZ string with daylight saving
      // For now we will compute the current time zone as a UTC offset
      // Note that what we call UTC+ 1 in called UTC-1 in Posix TZ format
      var offset = now.getTimezoneOffset();
      var abs_offset = Math.abs(offset);
      var hrs_offset = Math.floor(abs_offset / 60);
      var mins_offset = (abs_offset % 60);
      var tz = "UTC" + (offset < 0 ? '-' : '+') + hrs_offset + (mins_offset === 0 ? '' : ':' + mins_offset);

      var GetSystemDateAndTimeResponse = {
        SystemDateAndTime: {
          DateTimeType: "NTP",
          DaylightSavings: now.dst(),
          TimeZone: {
            TZ: tz
          },
          UTCDateTime: {
            Time: { Hour: now.getUTCHours(), Minute: now.getUTCMinutes(), Second: now.getUTCSeconds() },
            Date: { Year: now.getUTCFullYear(), Month: now.getUTCMonth() + 1, Day: now.getUTCDate() }
          },
          LocalDateTime: {
            Time: { Hour: now.getHours(), Minute: now.getMinutes(), Second: now.getSeconds() },
            Date: { Year: now.getFullYear(), Month: now.getMonth() + 1, Day: now.getDate() }
          },
          Extension: {}
        }
      };
      return GetSystemDateAndTimeResponse;
    };

    port.SetSystemDateAndTime = (args /*, cb, headers*/) => {
      var SetSystemDateAndTimeResponse = {};
      return SetSystemDateAndTimeResponse;
    };

    port.SystemReboot = (args /*, cb, headers*/) => {
      var SystemRebootResponse = {
        Message: Utils.execSync("sudo reboot")
      };
      return SystemRebootResponse;
    };

    port.GetServices = (args /*, cb, headers*/) => {
      // ToDo. Check value of args.IncludeCapability

      var GetServicesResponse = {
        Service: [
          {
            Namespace: "http://www.onvif.org/ver10/device/wsdl",
            XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/device_service`,
            Version: {
              Major: 2,
              Minor: 5,
            }
          },
          {
            Namespace: "http://www.onvif.org/ver20/imaging/wsdl",
            XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/imaging_service`,
            Version: {
              Major: 2,
              Minor: 5,
            }
          },
          {
            Namespace: "http://www.onvif.org/ver10/media/wsdl",
            XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/media_service`,
            Version: {
              Major: 2,
              Minor: 5,
            }
          },
          {
            Namespace: "http://www.onvif.org/ver20/ptz/wsdl",
            XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/ptz_service`,
            Version: {
              Major: 2,
              Minor: 5,
            },
          }]
      };

      return GetServicesResponse;
    };


    port.GetCapabilities = (args /*, cb, headers*/) => {
      var category = args.Category; // Category is Optional and may be undefined
      //{ 'All', 'Analytics', 'Device', 'Events', 'Imaging', 'Media', 'PTZ' }
      var GetCapabilitiesResponse = {
        Capabilities: {}
      };

      if (category === undefined || category == "All" || category == "Device") {
        GetCapabilitiesResponse.Capabilities["Device"] = {
          XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/device_service`,
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
            RelayOutputs: 1,
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
              Extension: {
                Dot1X: false,
                RemoteUserHandling: false
              }
            }
          },
          Extension: {}
        };
      }
      if (category == undefined || category == "All" || category == "Events") {
        GetCapabilitiesResponse.Capabilities["Events"] = {
          XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/events_service`,
          WSSubscriptionPolicySupport: false,
          WSPullPointSupport: false,
          WSPausableSubscriptionManagerInterfaceSupport: false
        }
      }
      if (category === undefined || category == "All" || category == "Imaging") {
        GetCapabilitiesResponse.Capabilities["Imaging"] = {
          XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/imaging_service`
        }
      }
      if (category === undefined || category == "All" || category == "Media") {
        GetCapabilitiesResponse.Capabilities["Media"] = {
          XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/media_service`,
          StreamingCapabilities: {
            RTPMulticast: this.config.MulticastEnabled,
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
      }
      if (category === undefined || category == "All" || category == "PTZ") {
        GetCapabilitiesResponse.Capabilities["PTZ"] = {
          XAddr: `http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/ptz_service`
        }
      }
      return GetCapabilitiesResponse;
    };

    port.GetHostname = (args /*, cb, headers*/) => {
      var GetHostnameResponse = {
        HostnameInformation: {
          FromDHCP: false,
          Name: hostname(),
          Extension: {}
        }
      };
      return GetHostnameResponse;
    };

    port.SetHostname = (args /*, cb, headers*/) => {
      var SetHostnameResponse = {};
      return SetHostnameResponse;
    };

    port.SetHostnameFromDHCP = (args /*, cb, headers*/) => {
      var SetHostnameFromDHCPResponse = {
        RebootNeeded: false
      };
      return SetHostnameFromDHCPResponse;
    };

    port.GetScopes = (args) => {
      var GetScopesResponse = { Scopes: [] };
      GetScopesResponse.Scopes.push({
        ScopeDef: "Fixed",
        ScopeItem: "onvif://www.onvif.org/location/unknow"
      });

      GetScopesResponse.Scopes.push({
        ScopeDef: "Fixed",
        ScopeItem: ("onvif://www.onvif.org/hardware/" + this.config.DeviceInformation.Model)
      });

      GetScopesResponse.Scopes.push({
        ScopeDef: "Fixed",
        ScopeItem: ("onvif://www.onvif.org/name/" + this.config.DeviceInformation.Manufacturer)
      });

      return GetScopesResponse;
    };

    port.GetServiceCapabilities = (args /*, cb, headers*/) => {
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
          //Misc : { 
          //  attributes : {
          //    AuxiliaryCommands : {tt:StringAttrList}
          //  }
          //}
        }
      };
      return GetServiceCapabilitiesResponse;
    };

    port.GetNTP = (args /*, cb, headers*/) => {
      var GetNTPResponse = {};
      return GetNTPResponse;
    };

    port.SetNTP = (args /*, cb, headers*/) => {
      var SetNTPResponse = {};
      return SetNTPResponse;
    };

    port.GetNetworkInterfaces = (args /*, cb, headers*/) => {
      var GetNetworkInterfacesResponse = {
        NetworkInterfaces: []
      };
      var nwifs = networkInterfaces();
      for (var nwif in nwifs) {
        for (var addr in nwifs[nwif]) {
          if (nwifs[nwif][addr].family === 'IPv4' && nwif !== 'lo0' && nwif !== 'lo') {
            var mac = (nwifs[nwif][addr].mac).replace(/:/g, '-');
            var ipv4_addr = nwifs[nwif][addr].address;
            var netmask = nwifs[nwif][addr].netmask;
            var prefix_len = subnet(ipv4_addr, netmask).subnetMaskLength;
            GetNetworkInterfacesResponse.NetworkInterfaces.push({
              attributes: {
                token: nwif
              },
              Enabled: true,
              Info: {
                Name: nwif,
                HwAddress: mac,
                MTU: 1500
              },
              IPv4: {
                Enabled: true,
                Config: {
                  Manual: {
                    Address: ipv4_addr,
                    PrefixLength: prefix_len
                  },
                  DHCP: false
                }
              }
            });
          }
        }
      }
      return GetNetworkInterfacesResponse;
    };

    port.GetNetworkProtocols = (args /*, cb, headers*/) => {
      var GetNetworkProtocolsResponse = {
        NetworkProtocols: [{
          Name: "RTSP",
          Enabled: true,
          Port: this.config.RTSPPort
        }]
      };
      return GetNetworkProtocolsResponse;
    };

    port.GetRelayOutputs = (args /*, cb, headers*/) => {
      var GetRelayOutputsResponse = {
        RelayOutputs: [{
          attributes: {
            token: "relay1"
          },
          Properties: {
            Mode: "Bistable",
            // DelayTime: "",
            IdleState: "open"
          }
        }]
      };
      return GetRelayOutputsResponse;
    };

    port.SetRelayOutputState = (args /*, cb, headers*/) => {
      var SetRelayOutputStateResponse = {};
      if (this.callback) {
        if (args.LogicalState === 'active') this.callback('relayactive', { name: args.RelayOutputToken });
        if (args.LogicalState === 'inactive') this.callback('relayinactive', { name: args.RelayOutputToken });
      }
      return SetRelayOutputStateResponse;
    };

    port.GetUsers = (args /*, cb, headers*/) => {
      var GetUsersResponse = {
        //        User : [{
        //          Username : '',
        //          Password : '',
        //          UserLevel : 'Administrator',
        //        }]
      };
      return GetUsersResponse;
    }


  }
}