///<reference path="../rpos.d.ts"/>

import { v4l2ctl } from "./v4l2ctl";
import dgram = require('dgram');
import SimpleUdpStream = require('simple-udp-stream'); // .write() function wrapper for UDP

// PTZDriver for RPOS (Raspberry Pi ONVIF Server)
// (c) 2016, 2017, 2018 Roger Hardiman
// (c) 2018 Casper Meijn
// MIT License
//
// This code processes the ONVIF Pan/Tilt/Zoom messages and generates a CCTV
// PTZ protocol such as Pelco D, Pelco P and sends these PTZ commands to a Serial Port
// or to a TCP Socket (as raw data bytes)
// It can also generate Pan/Tilt and Fire commands for the Tenx USB Missile Launcher

// Tenx USB Missile Launcher Support
// Opens the Tenx USB Missile Launcher USB IDs 0x1130 0x0202
// ONVIF Pan/Tilt turns the missile launcher
// ONVIF GotoPreset fires a foam missile (any preset will work)

// Pelco D PTZ Telemetry Support
// Opens a serial port (or network stream) and sends Pelco D commands including
// Pan, Tilt, Zoom and Preset commands. ONVIF Home Position is mapped to Preset 1.

// Pimoroni Pan-Tilt HAT Support
// Uses the Pimoroni Pan-Tilt HAT kit for the Raspberry Pi
// with Pan and Tilt functions

// For Imaging Service, commands are sent through to the V4L2 interface

class PTZDriver {

  config: rposConfig;
  tenx: any;
  pelcod: any;
  visca: any;
  viscaSeqNum: any = 0;
  udpSocket: any = null;
  pan_tilt_hat: any;
  serialPort: any;
  stream: any;
  supportsAbsolutePTZ: boolean = false;
  supportsRelativePTZ: boolean = false;
  supportsContinuousPTZ: boolean = false;
  supportsGoToHome: boolean = false;
  hasFixedHomePosition: boolean = true;

  constructor(config: rposConfig) {
    this.config = config;
    let parent = this;

    // Sanity checks. Do not open serial or socket if using USB Tenx driver
    let PTZOutput = config.PTZOutput;
    if (config.PTZDriver === 'tenx') {
      PTZOutput = 'none';
    }

    // Sanity checks. Do not open serial or socket if using Pan-Tilt HAT
    if (config.PTZDriver === 'pan-tilt-hat') {
      PTZOutput = 'none';
    }

    if (config.PTZDriver === 'tenx') {
      var TenxDriver = require('./tenx_driver');
      this.tenx = new TenxDriver();
      this.tenx.open();
      this.supportsContinuousPTZ = true;
    }

    if (config.PTZDriver === 'pan-tilt-hat') {
      var PanTiltHAT = require('pan-tilt-hat');
      this.pan_tilt_hat = new PanTiltHAT();
      this.supportsAbsolutePTZ = true;
      this.supportsRelativePTZ = true;
      this.supportsContinuousPTZ = true;
      this.supportsGoToHome = true
    }
    
    if (config.PTZDriver === 'pelcod') {
      this.supportsContinuousPTZ = true;
      this.supportsGoToHome = true
      this.hasFixedHomePosition = false;
    }
    
    if (config.PTZDriver === 'visca') {
      this.supportsContinuousPTZ = true;
      this.supportsGoToHome = true
    }

    if (PTZOutput === 'serial') {
      var SerialPort = require('serialport');
      this.serialPort = new SerialPort(config.PTZSerialPort, 
        {
        baudRate: config.PTZSerialPortSettings.baudRate,
        parity:   config.PTZSerialPortSettings.parity,
        dataBits: config.PTZSerialPortSettings.dataBits,
        stopBits: config.PTZSerialPortSettings.stopBits,
        }
      );
 
      this.stream = this.serialPort.on("open", function(err){
          if (err) {
            console.log('Error: '+err);
          return;
          } else {
            if (parent.config.PTZDriver === 'pelcod') {
              var PelcoD = require('node-pelcod');
              parent.pelcod = new PelcoD(parent.stream);
              parent.pelcod.setAddress(parent.config.PTZCameraAddress);
            }
            if (parent.config.PTZDriver === 'visca') {
              parent.visca = true;
            }
            // Initialise other protocols here
          }
      });
    }

    if (PTZOutput === 'tcp') {
      var net = require('net');
      this.stream = new net.Socket();
      
      let host = config.PTZOutputURL.split(':')[0];
      let port = config.PTZOutputURL.split(':')[1];      
      this.stream.on('data', function(data) {  
          console.log('PTZ Driver received socket data ' + data);
      });
      this.stream.on('close', function() {
        console.log('PTZ Driver - Socket closed');
      });
      this.stream.on('error', function() {
        console.log('PTZ Driver - Socket error');
      });
      console.log('PTZ Driver connecting to ' + host + ':' + port);
      this.stream.connect(port, host, function() {
        console.log('PTZ Driver connected to ' + host + ':' + port);

        if (parent.config.PTZDriver === 'pelcod') {
          var PelcoD = require('node-pelcod');
          console.log(parent.stream);
          parent.pelcod = new PelcoD(parent.stream);
          parent.pelcod.setAddress(parent.config.PTZCameraAddress);
        }
        if (parent.config.PTZDriver === 'visca') {
          parent.visca = true;
        }
        // Initialise other protocols here
      });
    }

    if (PTZOutput === 'udp') {

      let host = config.PTZOutputURL.split(':')[0];
      let port = config.PTZOutputURL.split(':')[1];

      // Stream used to send UDP packets. Each stream.write() will send one UDP packet
      // When sending VISCA over UDP we need to add the VISCA UDP Header bytes
      this.stream = new SimpleUdpStream({
        destination: host,
        port: port
      });

      if (parent.config.PTZDriver === 'visca') {
        parent.visca = true;


        const viscaUDPPort = 52381;
        // List on port 52381 for VISCA over UDP replies from the camera.... ACK and COMPLETED with the Sequence Number
        this.udpSocket = dgram.createSocket('udp4');

        this.udpSocket.on('error', (err) => {
          console.log(`Error with UDP Socket Listener:\n${err.stack}`);
          this.udpSocket.close();
        });

        this.udpSocket.on('message', (msg, rinfo) => {
          console.log('UDP Socket received: ' + msg.toString('hex') + ' from ' + rinfo.address + ':' + rinfo.port);
          // Formatof Sony Visca over IP reply is
          // 01 11 = VISCA Reply
          // 00 03 is the length of the VISCA message (3 bytes)
          // 00 00 00 09 is the 4 byte sequence number 
          // 90 41 ff is the VISCA message. or 90 42 ff    or 90 52 ff  or 90 51 ff
          // 01110003000000009041ff
          // 01110003000000019042ff
          // 01110003000000019052ff
          // 01110003000000009051ff
          let seqNum = -1;
          let msgType = 'UNKNOWN';
          let viscaReply = false;
          try {
            if (msg[0] == 0x01 && msg[1] == 0x11) {
              let length = (msg[2] << 8) + msg[3];
              if (2 + 2 + 4 + length != msg.byteLength) {
                // length error
              } else {
                seqNum = (msg[4] << 24) + (msg[5] << 16) + (msg[6] << 8) + (msg[7] << 0);
                if (msg[8] === 0x90 /*Visca over IP*/ && msg[10] === 0xFF) {
                  if ((msg[9] & 0xF0) === 0x40) {
                    msgType = 'ACK';
                    viscaReply = true;
                  }
                  if ((msg[9] & 0xF0) === 0x50) {
                    msgType = 'COMPLETION';
                    viscaReply = true;
                  }
                }
              }
            }
            if (viscaReply) console.log('VISCA OVER UDP Message Received: ' + seqNum + ' ' + msgType);
          } catch (err) {
            // ignore the error
          }
        });

        this.udpSocket.on('listening', () => {
          const address = this.udpSocket.address();
          console.log(`UDP Socket server listening ${address.address}:${address.port}`);
        });

        // Bind and start to listen
        this.udpSocket.bind(viscaUDPPort);



      }

      // Initialise other protocols here
    }
  }


// Data
//   name:
//   value:
//   pan:
//   tilt:
//   zoom:
// Use 'arrow functions' (instead of bind) to ensure the 'this' refers to the
// class and not to the caller's 'this'. This is required when process_ptz_command
// is used in a callback function.
  process_ptz_command = (command: string, data: any) => {
    if (command==='gotohome') {
      console.log("Goto Home");
      if (this.pelcod) this.pelcod.sendGotoPreset(1); // use preset 1 for Home
      if (this.visca) {
        let data: number[] = [];
        data.push(0x81,0x01,0x06,0x04,0xff);

        // Add VISCA over IP header
        if (this.config.PTZOutput === 'udp') {
          let header: number[] = [];
          header.push(0x01, 0x00, 0x00, data.length,
            this.viscaSeqNum >> 24 & 0xff,
            this.viscaSeqNum >> 16 & 0xff,
            this.viscaSeqNum >> 8 & 0xff,
            this.viscaSeqNum >> 0 & 0xff);
          this.viscaSeqNum = (this.viscaSeqNum + 1) & 0xffff;
          data = header.concat(data);
        }

        this.stream.write(new Buffer(data));
      }
      if (this.pan_tilt_hat) {
        this.pan_tilt_hat.goto_home();
      }
    }
    else if (command==='sethome') {
      console.log("SetHome ");
      if (this.pelcod) this.pelcod.sendSetPreset(1); // use preset 1 for Home
    }
    else if (command==='gotopreset') {
      console.log("Goto Preset "+ data.name + ' / ' + data.value);
      if (this.tenx) this.tenx.fire();
      if (this.pelcod) this.pelcod.sendGotoPreset(parseInt(data.value));
    }
    else if (command==='setpreset') {
      console.log("Set Preset "+ data.name + ' / ' + data.value);
      if (this.pelcod) this.pelcod.sendSetPreset(parseInt(data.value));
    }
    else if (command==='clearpreset') {
      console.log("Clear Preset "+ data.name + ' / ' + data.value);
      if (this.pelcod) this.pelcod.sendClearPreset(parseInt(data.value));
    }
    else if (command==='aux') {
      console.log("Aux "+ data.name);
      if (this.pelcod) {
        if (data.name === 'AUX1on') this.pelcod.sendSetAux(1);
        if (data.name === 'AUX1off') this.pelcod.sendClearAux(1);
        if (data.name === 'AUX2on') this.pelcod.sendSetAux(2);
        if (data.name === 'AUX2off') this.pelcod.sendClearAux(2);
        if (data.name === 'AUX3on') this.pelcod.sendSetAux(3);
        if (data.name === 'AUX3off') this.pelcod.sendClearAux(3);
        if (data.name === 'AUX4on') this.pelcod.sendSetAux(4);
        if (data.name === 'AUX4off') this.pelcod.sendClearAux(4);
        if (data.name === 'AUX5on') this.pelcod.sendSetAux(5);
        if (data.name === 'AUX5off') this.pelcod.sendClearAux(5);
        if (data.name === 'AUX6on') this.pelcod.sendSetAux(6);
        if (data.name === 'AUX6off') this.pelcod.sendClearAux(6);
        if (data.name === 'AUX7on') this.pelcod.sendSetAux(7);
        if (data.name === 'AUX7off') this.pelcod.sendClearAux(7);
        if (data.name === 'AUX8on') this.pelcod.sendSetAux(8);
        if (data.name === 'AUX8off') this.pelcod.sendClearAux(8);
      }
    }
    else if (command==='relayactive') {
      console.log("Relay Active "+ data.name);
    }
    else if (command==='relayinactive') {
      console.log("Relay Inactive "+ data.name);
    }
    else if (command==='ptz') {
      console.log("Continuous PTZ "+ data.pan + ' ' + data.tilt + ' ' + data.zoom);
      var p=0.0;
      var t=0.0;
      var z=0.0;
      try {p = parseFloat(data.pan)} catch (err) {}
      try {t = parseFloat(data.tilt)} catch (err) {}
      try {z = parseFloat(data.zoom)} catch (err) {}
      if (this.tenx) {
        if      (p < -0.1 && t >  0.1) this.tenx.upleft();
        else if (p >  0.1 && t >  0.1) this.tenx.upright();
        else if (p < -0.1 && t < -0.1) this.tenx.downleft();
        else if (p >  0.1 && t < -0.1) this.tenx.downright();
        else if (p >  0.1) this.tenx.right();
        else if (p < -0.1) this.tenx.left();
        else if (t >  0.1) this.tenx.up();
        else if (t < -0.1) this.tenx.down()
        else this.tenx.stop();
      }
      if (this.pelcod) {
        this.pelcod.up(false).down(false).left(false).right(false);
        if      (p < 0 && t > 0) this.pelcod.up(true).left(true);
        else if (p > 0 && t > 0) this.pelcod.up(true).right(true);
        else if (p < 0 && t < 0) this.pelcod.down(true).left(true);
        else if (p > 0 && t < 0) this.pelcod.down(true).right(true);
        else if (p > 0) this.pelcod.right(true);
        else if (p < 0) this.pelcod.left(true);
        else if (t > 0) this.pelcod.up(true);
        else if (t < 0) this.pelcod.down(true);

        // Set Pan/Tilt speed
        // scale speeds from 0..1 to 0..63
        var pan_speed = Math.round(Math.abs(p) * 63.0 );
        var tilt_speed = Math.round(Math.abs(t) * 63.0 );

        this.pelcod.setPanSpeed(pan_speed);
        this.pelcod.setTiltSpeed(tilt_speed);


        this.pelcod.zoomIn(false).zoomOut(false);
        if (z>0) this.pelcod.zoomIn(true);
        if (z<0) this.pelcod.zoomOut(true);

        // Set Zoom speed
        // scale speeds from 0..1 to 0 (slow), 1 (low med), 2 (high med), 3 (fast)
        var abs_z = Math.abs(z);
        var zoom_speed = 0;
        if (abs_z > 0.75) zoom_speed = 3;
        else if (abs_z > 0.5) zoom_speed = 2;
        else if (abs_z > 0.25) zoom_speed = 1;
        else zoom_speed = 0;

        // sendSetZoomSpeed is not in node-pelcod yet so wrap with try/catch
        try {
          if (z != 0) this.pelcod.sendSetZoomSpeed(zoom_speed);
        } catch (err) {}

        this.pelcod.send();
      }
      if (this.visca) {
        // Map ONVIF Pan and Tilt Speed 0 to 1 to VISCA Speed 1 to 0x18
        // Map ONVIF Zoom Speed (0 to 1) to VISCA Speed 0 to 7
        let visca_pan_speed = Math.round((Math.abs(p) * 0x18) / 1.0);
        let visca_tilt_speed = Math.round((Math.abs(t) * 0x18) / 1.0);
        let visca_zoom_speed = Math.round((Math.abs(z) * 0x07) / 1.0);

        // rounding check. Visca Pan/Tilt to be in range 0x01 .. 0x18 if the input speed was not zero
        if (Math.abs(p) != 0 && visca_pan_speed === 0) visca_pan_speed = 1;
        if (Math.abs(t) != 0 && visca_tilt_speed === 0) visca_tilt_speed = 1;
        if (Math.abs(z) != 0 && visca_zoom_speed === 0) visca_zoom_speed = 1;

        if (this.config.PTZDriver === 'visca') {
          let data: number[] = [];
          if      (p < 0 && t > 0) { // upleft
            data.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x01, 0x01, 0xff);
          }
          else if (p > 0 && t > 0) { // upright
            data.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x02, 0x01, 0xff);
          }
          else if (p < 0 && t < 0) { // downleft;
            data.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x01, 0x02, 0xff);
          }
          else if (p >  0 && t < 0) { // downright;
            data.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x02, 0x02, 0xff);
          }
          else if (p > 0) { // right
            data.push(0x81,0x01,0x06,0x01,visca_pan_speed,0x00,0x02,0x03,0xff);
          }
          else if (p < 0) { // left
            data.push(0x81,0x01,0x06,0x01,visca_pan_speed,0x00,0x01,0x03,0xff);
          }
          else if (t > 0) { // up
            data.push(0x81,0x01,0x06,0x01,0x00,visca_tilt_speed,0x03,0x01,0xff);
          }
          else if (t < 0) { // down
            data.push(0x81,0x01,0x06,0x01,0x00,visca_tilt_speed,0x03,0x02,0xff);
          }
          else { // stop 
            data.push(0x81,0x01,0x06,0x01,0x00,0x00,0x03,0x03,0xff);
          }

          // Add Sony UDP VISCA over IP header with sequence number
          if (this.config.PTZOutput === 'udp') {
            let header: number[] = [];
            header.push(0x01, 0x00, 0x00, data.length,
              this.viscaSeqNum >> 24 & 0xff,
              this.viscaSeqNum >> 16 & 0xff,
              this.viscaSeqNum >> 8 & 0xff,
              this.viscaSeqNum >> 0 & 0xff);
            this.viscaSeqNum = (this.viscaSeqNum + 1) & 0xffff;
            data = header.concat(data);
          }

          this.stream.write(new Buffer(data));

          data = [];

          // Zoom
          if (z < 0) { // zoom out
            data.push(0x81,0x01,0x04,0x07,(0x30 + visca_zoom_speed),0xff);
          }
          else if (z > 0) { // zoom in
            data.push(0x81,0x01,0x04,0x07,(0x20 + visca_zoom_speed),0xff);
          } else { // zoom stop
            data.push(0x81,0x01,0x04,0x07,0x00,0xff);
          }

          // Add Sony UDP VISCA over IP header with sequence number
          if (this.config.PTZOutput === 'udp') {
            let header: number[] = [];
            header.push(0x01, 0x00, 0x00, data.length,
              this.viscaSeqNum >> 24 & 0xff,
              this.viscaSeqNum >> 16 & 0xff,
              this.viscaSeqNum >> 8 & 0xff,
              this.viscaSeqNum >> 0 & 0xff);
            this.viscaSeqNum = (this.viscaSeqNum + 1) & 0xffff;
            data = header.concat(data);
          }

          this.stream.write(new Buffer(data));
        }
      }
      if (this.pan_tilt_hat) {
        // Map ONVIF Pan and Tilt Speed 0 to 1 to Speed 0 to 15
        let pan_speed  = ( Math.abs(p) * 15) / 1.0;
        let tilt_speed = ( Math.abs(t) * 15) / 1.0;

        // rounding check.
        if (pan_speed > 15) pan_speed = 15;
        if (tilt_speed > 15) tilt_speed = 15;
        if (pan_speed < 0) pan_speed = 0;
        if (tilt_speed < 0) tilt_speed = 0;

        if (p < 0)  this.pan_tilt_hat.pan_left(pan_speed);
        if (p > 0)  this.pan_tilt_hat.pan_right(pan_speed);
        if (p == 0) this.pan_tilt_hat.pan_right(0); // stop
        if (t < 0)  this.pan_tilt_hat.tilt_down(tilt_speed);
        if (t > 0)  this.pan_tilt_hat.tilt_up(tilt_speed);
        if (t == 0) this.pan_tilt_hat.tilt_down(0); // stop
      }
    }
    else if (command==='absolute-ptz') {
      console.log("Absolute PTZ "+ data.pan + ' ' + data.tilt + ' ' + data.zoom);
      var p=0.0;
      var t=0.0;
      var z=0.0;
      try {p = parseFloat(data.pan)} catch (err) {}
      try {t = parseFloat(data.tilt)} catch (err) {}
      try {z = parseFloat(data.zoom)} catch (err) {}
      if (this.pan_tilt_hat) {
          let new_pan_angle = p * 90.0
          this.pan_tilt_hat.pan(Math.round(new_pan_angle));
          
          let new_tilt_angle = t * 80.0
          this.pan_tilt_hat.tilt(Math.round(new_tilt_angle));
      }
    }
    else if (command==='relative-ptz') {
      console.log("Relative PTZ "+ data.pan + ' ' + data.tilt + ' ' + data.zoom);
      var p=0.0;
      var t=0.0;
      var z=0.0;
      try {p = parseFloat(data.pan)} catch (err) {}
      try {t = parseFloat(data.tilt)} catch (err) {}
      try {z = parseFloat(data.zoom)} catch (err) {}
      if (this.pan_tilt_hat) {
          let pan_degrees = p * 90.0
          let new_pan_angle = this.pan_tilt_hat.pan_position - pan_degrees;
          this.pan_tilt_hat.pan(Math.round(new_pan_angle));
          
          let tilt_degrees = t * 80.0
          let new_tilt_angle = this.pan_tilt_hat.tilt_position - tilt_degrees;
          this.pan_tilt_hat.tilt(Math.round(new_tilt_angle));
      }
    }
    else if (command==='brightness') {
      console.log("Set Brightness "+ data.value);
      v4l2ctl.SetBrightness(data.value);
    }
    else if (command==='focus') {
      console.log("Focus "+ data.value);
      if (this.pelcod) {
        if (data.value < 0) this.pelcod.focusNear(true);
        else if (data.value > 0) this.pelcod.focusFar(true);
        else {
          this.pelcod.focusNear(false);
          this.pelcod.focusFar(false);
        }
        this.pelcod.send();
      }
    }
    else if (command==='focusstop') {
      console.log("Focus Stop");
      if (this.pelcod) {
        this.pelcod.focusNear(false);
        this.pelcod.focusFar(false);
        this.pelcod.send();
      }
    }
    else {
      if (!data.value) {
        console.log("Unhandled PTZ/Imaging Command Received: " + command);
      } else {
        console.log("Unhandled PTZ/Imaging Command Received: " + command + ' Value:' + data.value);
      }
    }
  }
}

export = PTZDriver;
