export type RposConfig = {
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
  
  export type PTZSerialPortSettings = {
    baudRate: number;
    dataBits: number;
    parity: string;
    stopBits: number;
  }

  export type DeviceInformation = {
    Manufacturer: string;
    Model: string;
    HardwareId: string;
    SerialNumber: string;
    FirmwareVersion: string;
  }