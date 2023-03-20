///<reference path="./lib/extension.ts"/>
interface rposConfig {
  NetworkAdapters: string[];
  IpAddress: string;
  ServicePort: number;
  Username: string;
  Password: string;
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
interface CameraSettings {
  gop: number; //keyframe every X sec.
  resolution: Resolution;
  framerate: number;
  bitrate: number;
  quality: number;
}
