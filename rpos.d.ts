///<reference path="./lib/extension.ts"/>
interface rposConfig {
  NetworkAdapters: string[];
  IpAddress: string;
  ServicePort: number;
  Username: string;
  Password: string;
  Cameras: CameraSettings[];
  CameraName: string;
  CameraType: string;
  CameraDevice: string;
  RTSPAddress: string;
  RTSPPort: number;
  RTSPName: string;
  RTSPServer: number;
  MulticastEnabled: boolean;
  RTSPMulticastName : string;
  MulticastAddress: string;
  MulticastPort: number;
  PTZDriver: string;
  PTZOutput: string;
  PTZSerialPort: string;
  PTZSerialPortSettings: PTZSerialPortSettings;
  PTZOutputURL: string;
  PTZCameraAddress: number;
  DeviceInformation: DeviceInformation;
  logLevel: number;
  logSoapCalls: Boolean;
}

interface CameraSettings {
  CameraName: string;
  CameraType: string;
  CameraDevice: string;
  RTSPAddress: string;
  RTSPPort: number;
  RTSPName: string;
  RTSPServer: number;
  MulticastEnabled: boolean;
  RTSPMulticastName: string;
  MulticastAddress: string;
  MulticastPort: number;
  PTZCameraAddress: number; // There is currently one global PTZ output. This defines the camera number
}

interface PTZSerialPortSettings {
  baudRate: number;
  dataBits: number;
  parity: string;
  stopBits: number;
}

interface DeviceInformation {
  Manufacturer: string;
  Model: string;
  HardwareId: string;
  SerialNumber: string;
  FirmwareVersion: string;
}

interface TypeConstructor extends Function {
  name: string;
}

interface SoapServiceOptions {
  path: string,
  services: any,
  xml: any,
  wsdlPath: string,
  onReady: () => void;
}

interface Date {
  stdTimezoneOffset: () => number;
  dst: () => boolean;
}

interface UserControlOptions<T> {
  stringify?: (T) => string,
  range?: {
    min: T,
    max: T,
    allowZero?: boolean,
    step?: T
  }
  lookupSet?: UserControlsLookupSet<T>;
}

interface UserControlsLookup<T> {
  value: T;
  desc: string;
}
interface UserControlsLookupSet<T> extends Array<UserControlsLookup<T>> {

}

interface Resolution {
  Width: number;
  Height: number;
}
interface CameraSettingsParameter {
  gop: number; //keyframe every X sec.
  resolution: Resolution;
  framerate: number;
  bitrate: number;
  profile: string;
  quality: number;
}
interface CameraSettingsBase {
  forceGop: boolean; // Use iframe interval setting from v4l2ctl.json instead of Onvif
  resolution: Resolution;
  framerate: number;
}

type VideoSource = {
  attributes: {
    token: string
  },
  Framerate: number,
  Resolution: {
    Width: number,
    Height: number
  }
}

type VideoSourceConfiguration = {
  Name: string
  attributes: {
    token: string
  },
  UseCount: number,
  SourceToken: string,
  Bounds: {
    attributes: {
      x: number,
      y: number,
      width: number,
      height: number
    }
  }
}

type SavedProfile = {
  name: string,
  token: string,
  videoSourceConfigurationToken: string,
  videoEncoderConfigurationToken: string,
  ptzConfigurationToken: string
}

type Profile = {
  Name: string
  attributes: {
    token: string,
    fixed: boolean
  },
  VideoSourceConfiguration?: VideoSourceConfiguration,
  VideoEncoderConfiguration?: any,
  PTZConfiguration?: any
};