///<reference path="../rpos.d.ts"/>

import { v4l2ctl } from "./v4l2ctl";
import dgram = require('dgram');
import SimpleUdpStream = require('simple-udp-stream'); // .write() function wrapper for UDP
import EventEmitter = require("events");

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
  onvif: any;
  visca: any;
  viscaSeqNum: any = 0;
  udpSocket: any = null;
  udpEventEmitter: EventEmitter = new EventEmitter();
  pan_tilt_hat: any;
  serialPort: any;
  stream: any;
  supportsAbsolutePTZ: boolean = false;
  supportsRelativePTZ: boolean = false;
  supportsContinuousPTZ: boolean = false;
  requested_p: number = 0;
  requested_t: number = 0;
  requested_z: number = 0;
  last_p: number = 0;
  last_t: number = 0;
  last_z: number = 0;
  supportsGoToHome: boolean = false;
  hasFixedHomePosition: boolean = true;

  last_sent_p: number = null;
  last_sent_t: number = null;
  last_sent_z: number = null;
  current_p: number = null;
  current_t: number = null;
  current_z: number = null;

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

    if (config.PTZDriver === 'onvif') {
      this.supportsContinuousPTZ = true;
      this.supportsGoToHome = true;
      this.hasFixedHomePosition = false;

      var Cam = require('onvif').Cam;

      let username: string = "";
      let password: string = "";
      let host: string = "";
      let port: string = "";
      if (config.PTZOutputURL.includes("@")) {
        let usernamePassword = config.PTZOutputURL.split('@')[0];
        username = usernamePassword.split(':')[0];
        password = usernamePassword.split(':')[1];

        let hostPort = config.PTZOutputURL.split('@')[1];
        host = hostPort.split(':')[0];
        port = hostPort.split(':')[1];
      } else {
        let hostPort = config.PTZOutputURL;
        host = hostPort.split(':')[0];
        port = hostPort.split(':')[1];
      }

      // Connect to ONVIF camera and select the 'default' profile
      new Cam(
        {
          hostname: host,
          username: username,
          password: password,
          port: port,
          timeout: 5000,
        },
        function CamFunc(err: any) {
          if (err) {
            if (err.message) { console.log(err.message); } else { console.log(err); }
            return;
          }
          parent.onvif = this;
        });
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
      this.stream = new SimpleUdpStream({
        destination: host,
        port: port
      });

      if (parent.config.PTZDriver === 'visca') {
        parent.visca = true;

        // Listen on port 52381 for VISCA over UDP replies from the camera.... We get ACK and COMPLETED replies with the Sequence Number
        const viscaUDPPort = 52381;
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
          let viscaCompleted = false;
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
                    viscaCompleted = true;
                  }
                }
              }
            }
            if (viscaReply) console.log('VISCA OVER UDP Message Received: ' + seqNum + ' ' + msgType);
            const eventName = 'completed' + seqNum;
            if (viscaCompleted) this.udpEventEmitter.emit(eventName, seqNum);

          } catch (err) {
            // ignore
            console.log('Error with UDP data received ' + err);
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

    // Start the Interval Timer that monitors current Pan, Tilt and Zoom values
    // This is used to allow rapid and frequently changing values to come in via ONVIF commands and to go into global variables, but to poll these global variables on a regular basis
    // and send out values to the physical device/motors/serial port.
    // This overcomes the issue where an ONVIf VMS or ODM can send out lots of very fast changing values, especially with a 3-axis PTZ joystick
    setTimeout(this.checkPTZValues, 0);

  }

  // Promise function. Sends the VISCA command and only Resolves (completes the 'task' when we have a UDP COMPLETION command for the right sequeunce)
  ViscaUDPSend = (msg: Buffer) => {
    return new Promise((resolve, reject) => {
      try {
        let seqNum = (msg[4] << 24) + (msg[5] << 16) + (msg[6] << 8) + (msg[7] << 0);

        // look for 'completedXYZ' with the sequence number as part of the event name
        const eventName = 'completed' + seqNum;
        this.udpEventEmitter.on(eventName, (completedSeqNum) => {
          resolve('completed')
        });

        // We are now ready for the UDP reply, so send the UDP message
        console.log('VISCA OVER UDP Sending Message ' + seqNum)
        this.stream.write(msg);
      } catch (err) {
        reject(err);
      }
    });
  }

  sendOnvifPanTiltZoom(p: number, t: number, z: number) {
    return new Promise((resolve, reject) => {
      try {
        let opts = {};
        if (p != null && t != null) {
          opts = {
            x: p.toString(),
            y: t.toString(),
            onlySendXY: true // enable the ONVIF command where just X and Y are sent, and no Zoom value is transmitted (Sony e-PTZ camera requires this)
            //zoom: z
          };
        } else {
          opts = {
            zoom: z,
            onlySendZoom: true // enable the ONVIF command where just Zoom is sent
          };
        }

        // send an new ONVIF PTZ command
        this.onvif.continuousMove(opts,
          // completion callback function
          function (err: any, stream: any, xml: any) {
            if (err) {
              console.log("Error sending out an ONVIF PTZ command " + err);
              reject(err);
            } else {
              console.log('ONVIF move command sent');
              resolve('completed');
            }
          });
      } catch (err) {
        reject(err);
      }
    });
  }


  // ViscaTask looks at the last sent values for Pan, Tilt and Zoom
  // If any values have changed, we pass new values onto the camera
  // We wait for the VISCA Completed event and then check the values again
  checkPTZValues = async () => {
    // take a snapshot of the current Pan, Tilt and Zoom value
    let p = this.requested_p;
    let t = this.requested_t;
    let z = this.requested_z;

    // Check if there is any work to do
    if (p == this.last_p && t == this.last_t && z == this.last_z) {
      // nothing more to do
      setTimeout(this.checkPTZValues, 20); // take another look in 20ms
      return;
    }

    if (this.tenx) {
      if (p < -0.1 && t > 0.1) this.tenx.upleft();
      else if (p > 0.1 && t > 0.1) this.tenx.upright();
      else if (p < -0.1 && t < -0.1) this.tenx.downleft();
      else if (p > 0.1 && t < -0.1) this.tenx.downright();
      else if (p > 0.1) this.tenx.right();
      else if (p < -0.1) this.tenx.left();
      else if (t > 0.1) this.tenx.up();
      else if (t < -0.1) this.tenx.down()
      else this.tenx.stop();
    }
    if (this.pelcod) {
      this.pelcod.up(false).down(false).left(false).right(false);
      if (p < 0 && t > 0) this.pelcod.up(true).left(true);
      else if (p > 0 && t > 0) this.pelcod.up(true).right(true);
      else if (p < 0 && t < 0) this.pelcod.down(true).left(true);
      else if (p > 0 && t < 0) this.pelcod.down(true).right(true);
      else if (p > 0) this.pelcod.right(true);
      else if (p < 0) this.pelcod.left(true);
      else if (t > 0) this.pelcod.up(true);
      else if (t < 0) this.pelcod.down(true);

      // Set Pan/Tilt speed
      // scale speeds from 0..1 to 0..63
      var pan_speed = Math.round(Math.abs(p) * 63.0);
      var tilt_speed = Math.round(Math.abs(t) * 63.0);

      this.pelcod.setPanSpeed(pan_speed);
      this.pelcod.setTiltSpeed(tilt_speed);


      this.pelcod.zoomIn(false).zoomOut(false);
      if (z > 0) this.pelcod.zoomIn(true);
      if (z < 0) this.pelcod.zoomOut(true);

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
      } catch (err) { }

      this.pelcod.send();
    }
    if (this.onvif) {
      console.log("OUTPUT ONVIF " + p + " " + t + " " + z);
      if (z != 0 || (z == 0 && this.last_z != 0))
        // Sony camera only wants Zoom. pass null for Pan/Tilt so we don't include them in the XML
        await this.sendOnvifPanTiltZoom(null, null, z);
      else {
        // Sony camera only wants PanTilt. pass null for the Zoom so we don't include it in the XML
        await this.sendOnvifPanTiltZoom(p, t, null);
      }
    }
    if (this.visca) {
      // Map ONVIF Pan and Tilt Speed 0 to 1 to VISCA Speed. Pan Speed 0 to 0x18. Tilt speed varies, 1 to 0x14 or to 0x17
      // Map ONVIF Zoom Speed (0 to 1) to VISCA Speed 0 to 7
      let visca_pan_speed = Math.round((Math.abs(p) * 0x18) / 1.0);  //
      let visca_tilt_speed = Math.round((Math.abs(t) * 0x14) / 1.0); // EVI-D100 range is 0x01 to 0x14 but SRG-XP1 is 0x01 to 0x17/ Should use VISCA command to ask for Pan-Tilt speed via Inquire
      let visca_zoom_speed = Math.round((Math.abs(z) * 0x07) / 1.0);

      // rounding check. Visca Pan/Tilt to be in range 0x01 .. 0x18 if the input speed was not zero
      if (Math.abs(p) != 0 && visca_pan_speed === 0) visca_pan_speed = 1;
      if (Math.abs(t) != 0 && visca_tilt_speed === 0) visca_tilt_speed = 1;
      if (Math.abs(z) != 0 && visca_zoom_speed === 0) visca_zoom_speed = 1;

      // PAN and TILT message
      if (this.config.PTZDriver === 'visca') {

        // VISCA devices support 2 commands at the same time
        let data1: number[] = [];
        let data2: number[] = [];
        if (p < 0 && t > 0) { // upleft
          data1.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x01, 0x01, 0xff);
        }
        else if (p > 0 && t > 0) { // upright
          data1.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x02, 0x01, 0xff);
        }
        else if (p < 0 && t < 0) { // downleft;
          data1.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x01, 0x02, 0xff);
        }
        else if (p > 0 && t < 0) { // downright;
          data1.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, visca_tilt_speed, 0x02, 0x02, 0xff);
        }
        else if (p > 0) { // right
          data1.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, 0x00, 0x02, 0x03, 0xff);
        }
        else if (p < 0) { // left
          data1.push(0x81, 0x01, 0x06, 0x01, visca_pan_speed, 0x00, 0x01, 0x03, 0xff);
        }
        else if (t > 0) { // up
          data1.push(0x81, 0x01, 0x06, 0x01, 0x00, visca_tilt_speed, 0x03, 0x01, 0xff);
        }
        else if (t < 0) { // down
          data1.push(0x81, 0x01, 0x06, 0x01, 0x00, visca_tilt_speed, 0x03, 0x02, 0xff);
        }
        else { // stop 
          data1.push(0x81, 0x01, 0x06, 0x01, 0x00, 0x00, 0x03, 0x03, 0xff);
        }

        // Zoom
        if (z < 0) { // zoom out
          data2.push(0x81, 0x01, 0x04, 0x07, (0x30 + visca_zoom_speed), 0xff);
        }
        else if (z > 0) { // zoom in
          data2.push(0x81, 0x01, 0x04, 0x07, (0x20 + visca_zoom_speed), 0xff);
        } else { // zoom stop
          data2.push(0x81, 0x01, 0x04, 0x07, 0x00, 0xff);
        }

        console.log("VISCA OUT " + visca_pan_speed + " " + visca_tilt_speed + " " + visca_zoom_speed);

        // Add Sony UDP VISCA over IP header with sequence number
        if (this.config.PTZOutput === 'udp') {
          let header: number[] = [];
          header.push(0x01, 0x00, 0x00, data1.length,
            this.viscaSeqNum >> 24 & 0xff,
            this.viscaSeqNum >> 16 & 0xff,
            this.viscaSeqNum >> 8 & 0xff,
            this.viscaSeqNum >> 0 & 0xff);
          this.viscaSeqNum = (this.viscaSeqNum + 1) & 0xffff;
          data1 = header.concat(data1);
        }

        // and again for 'data2'
        if (this.config.PTZOutput === 'udp') {
          let header: number[] = [];
          header.push(0x01, 0x00, 0x00, data2.length,
            this.viscaSeqNum >> 24 & 0xff,
            this.viscaSeqNum >> 16 & 0xff,
            this.viscaSeqNum >> 8 & 0xff,
            this.viscaSeqNum >> 0 & 0xff);
          this.viscaSeqNum = (this.viscaSeqNum + 1) & 0xffff;
          data2 = header.concat(data2);
        }

        if (this.config.PTZOutput === 'udp') {

          try {
            // create both promises, so they can run in parallel
            let promise1 = this.ViscaUDPSend(new Buffer(data1));
            let promise2 = this.ViscaUDPSend(new Buffer(data2));

            // await for both promises
            await promise1;
            await promise2;

            console.log("Promise Waits finished");
          } catch (err) {
            console.log("Promise error " + err);
          }
        } else {
          this.stream.write(new Buffer(data1));
          this.stream.write(new Buffer(data2));
        }

      }
    }
    if (this.pan_tilt_hat) {
      // Map ONVIF Pan and Tilt Speed 0 to 1 to Speed 0 to 15
      let pan_speed = (Math.abs(p) * 15) / 1.0;
      let tilt_speed = (Math.abs(t) * 15) / 1.0;

      // rounding check.
      if (pan_speed > 15) pan_speed = 15;
      if (tilt_speed > 15) tilt_speed = 15;
      if (pan_speed < 0) pan_speed = 0;
      if (tilt_speed < 0) tilt_speed = 0;

      if (p < 0) this.pan_tilt_hat.pan_left(pan_speed);
      if (p > 0) this.pan_tilt_hat.pan_right(pan_speed);
      if (p == 0) this.pan_tilt_hat.pan_right(0); // stop
      if (t < 0) this.pan_tilt_hat.tilt_down(tilt_speed);
      if (t > 0) this.pan_tilt_hat.tilt_up(tilt_speed);
      if (t == 0) this.pan_tilt_hat.tilt_down(0); // stop
    }


    this.last_p = p;
    this.last_t = t;
    this.last_z = z;

    setTimeout(this.checkPTZValues, 20); // take another look in the future
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
  process_ptz_command = async (command: string, data: any) => {
    if (command === 'gotohome') {
      console.log("Goto Home");
      if (this.pelcod) this.pelcod.sendGotoPreset(1); // use preset 1 for Home
      if (this.visca) {
        let data: number[] = [];
        data.push(0x81, 0x01, 0x06, 0x04, 0xff);

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
    else if (command === 'sethome') {
      console.log("SetHome ");
      if (this.pelcod) this.pelcod.sendSetPreset(1); // use preset 1 for Home
    }
    else if (command === 'gotopreset') {
      console.log("Goto Preset " + data.name + ' / ' + data.value);
      if (this.tenx) this.tenx.fire();
      if (this.pelcod) this.pelcod.sendGotoPreset(parseInt(data.value));
    }
    else if (command === 'setpreset') {
      console.log("Set Preset " + data.name + ' / ' + data.value);
      if (this.pelcod) this.pelcod.sendSetPreset(parseInt(data.value));
    }
    else if (command === 'clearpreset') {
      console.log("Clear Preset " + data.name + ' / ' + data.value);
      if (this.pelcod) this.pelcod.sendClearPreset(parseInt(data.value));
    }
    else if (command === 'aux') {
      console.log("Aux " + data.name);
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
    else if (command === 'relayactive') {
      console.log("Relay Active " + data.name);
    }
    else if (command === 'relayinactive') {
      console.log("Relay Inactive " + data.name);
    }
    else if (command === 'ptz') {
      console.log("Continuous PTZ " + data.pan + ' ' + data.tilt + ' ' + data.zoom);
      // Update the Global Variables. The worker task will send commands to the camera
      try { this.requested_p = parseFloat(data.pan) } catch (err) { }
      try { this.requested_t = parseFloat(data.tilt) } catch (err) { }
      try { this.requested_z = parseFloat(data.zoom) } catch (err) { }
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
