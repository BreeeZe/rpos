///<reference path="../../lib/extension.ts"/>
interface rposConfig {
  NetworkAdapter: string;
  IpAddress: string;
  ServicePort: number;
  RTSPPort: number;
  RTSPName: string;
  DeviceInformation: DeviceInformation;
  logLevel: logLevel;
  logSoapCalls: Boolean;
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

declare enum logLevel {
		None = 0,
		Error = 1,
		Warn = 2,
		Info = 3,
		Debug = 4
}