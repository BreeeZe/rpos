///<reference path="../typings/main.d.ts"/>
///<reference path="../rpos.d.ts"/>

// PTZDriver for RPOS (Raspberry Pi ONVIF Server)
// (c) 2016, 2017 Roger Hardiman
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

class PTZDriver {

  config: rposConfig;
  tenx: any;
  pelcod: any;
  visca: any;
  serialPort: any;
  stream: any;

  constructor(config: rposConfig) {
    this.config = config;
    let parent = this;

    // Sanity checks. Do not open serial or socket if using USB Tenx driver
    let PTZOutput = config.PTZOutput;
    if (config.PTZDriver === 'tenx') {
      PTZOutput = 'none';
    }

    if (config.PTZDriver === 'tenx') {
      var TenxDriver = require('./tenx_driver');
      this.tenx = new TenxDriver();
      this.tenx.open();
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
        this.stream.write(new Buffer(data));
      }
    }
    if (command==='sethome') {
      console.log("SetHome ");
      if (this.pelcod) this.pelcod.sendSetPreset(1); // use preset 1 for Home
    }
    if (command==='gotopreset') {
      console.log("Goto Preset "+ data.name + ' / ' + data.value);
      if (this.tenx) this.tenx.fire();
      if (this.pelcod) this.pelcod.sendGotoPreset(parseInt(data.value));
    }
    if (command==='setpreset') {
      console.log("Set Preset "+ data.name + ' / ' + data.value);
      if (this.pelcod) this.pelcod.sendSetPreset(parseInt(data.value));
    }
    if (command==='clearpreset') {
      console.log("Clear Preset "+ data.name + ' / ' + data.value);
      if (this.pelcod) this.pelcod.sendClearPreset(parseInt(data.value));
    }
    if (command==='aux') {
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
    if (command==='relayactive') {
      console.log("Relay Active "+ data.name);
    }
    if (command==='relayinactive') {
      console.log("Relay Inactive "+ data.name);
    }
    if (command==='ptz') {
      console.log("PTZ "+ data.pan + ' ' + data.tilt + ' ' + data.zoom);
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
        let visca_pan_speed = ( Math.abs(p) * 0x18) / 1.0;
        let visca_tilt_speed = ( Math.abs(t) * 0x18) / 1.0;
        let visca_zoom_speed = ( Math.abs(z) * 0x07) / 1.0;

        // rounding check. Visca Pan/Tilt to be in range 0x01 .. 0x18
        if (visca_pan_speed === 0) visca_pan_speed = 1;
        if (visca_tilt_speed === 0) visca_tilt_speed = 1;

        if (this.config.PTZDriver === 'visca') {
          let data: number[] = [];
          if      (p < 0 && t > 0) { // upleft
            data.push(0x81,0x01,0x06,0x01,visca_pan_speed,visca_zoom_speed,0x01,0x01,0xff);
          }
          else if (p > 0 && t > 0) { // upright
            data.push(0x81,0x01,0x06,0x01,visca_pan_speed,visca_zoom_speed,0x02,0x01,0xff);
          }
          else if (p < 0 && t < 0) { // downleft;
            data.push(0x81,0x01,0x06,0x01,visca_pan_speed,visca_zoom_speed,0x01,0x02,0xff);
          }
          else if (p >  0 && t < 0) { // downright;
            data.push(0x81,0x01,0x06,0x01,visca_pan_speed,visca_zoom_speed,0x02,0x01,0xff);
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

          // Zoom
          if (z < 0) { // zoom out
            data.push(0x81,0x01,0x04,0x07,(0x30 + visca_zoom_speed),0xff);
          }
          else if (z > 0) { // zoom in
            data.push(0x81,0x01,0x04,0x07,(0x20 + visca_zoom_speed),0xff);
          } else { // zoom stop
            data.push(0x81,0x01,0x04,0x07,0x00,0xff);
          }

          this.stream.write(new Buffer(data));
        }
      }
    }
  }
}

export = PTZDriver;
