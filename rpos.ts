/// <reference path="./rpos.d.ts"/>
/// <reference path="./typings/main.d.ts"/>

/*
The MIT License(MIT)

Copyright(c) 2015 Jeroen Versteege

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files(the "Software"), to deal 
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject tothe following conditions:

    The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
require("./lib/extension");

import http = require("http");
import express = require("express");
import { Utils } from "./lib/utils";
import Camera = require("./lib/camera");
import DeviceService = require("./services/device_service");
import MediaService = require("./services/media_service");
import PTZService = require("./services/ptz_service");
import DiscoveryService = require("./services/discovery_service");

var utils = Utils.utils;
let pjson = require("./package.json");
let config = <rposConfig>require("./rposConfig.json");

utils.log.level = <Utils.logLevel>config.logLevel;

config.DeviceInformation.SerialNumber = utils.getSerial();
config.DeviceInformation.FirmwareVersion = pjson.version;
utils.setConfig(config);
utils.testIpAddress();

for (var i in config.DeviceInformation) {
  utils.log.info("%s : %s", i, config.DeviceInformation[i]);
}

let webserver = express();
let httpserver = http.createServer(webserver);

let camera = new Camera(config, webserver);
let device_service = new DeviceService(config, httpserver);
let media_service = new MediaService(config, httpserver, camera);
let ptz_service = new PTZService(config, httpserver, ptz_callback);
let discovery_service = new DiscoveryService(config);

device_service.start();
media_service.start();
ptz_service.start();
discovery_service.start();


//
// Tenx USB Missile Launcher Support
// By Roger Hardiman, 2016
// Opens the Tenx USB Missile Launcher USB IDs 0x1130 0x0202
// ONVIF Pan/Tilt turns the missile launcher
// ONVIF GotoPreset fires a foam missile (any preset will work)
//

var tenx;
if (config.PTZDriver === 'tenx') {
  var TenxDriver = require('./tenx_driver');
  tenx = new TenxDriver();
  tenx.open();
}

//
// Pelco D PTZ Telemetry Support
// By Roger Hardiman, 2016
// Opens a serial port (or other NodeJS stream) and sends Pelco D
// commands including Pan, Tilt, Zoom and Preset commands
// Home Position is mapped to Preset 1
//

var pelcod;
var serialPort;

if (config.PTZDriver === 'pelcod') {
  var PelcoD = require('node-pelcod');
  var SerialPort = require('serialport');
  serialPort = new SerialPort(config.PTZSerialPort, 
    {
    baudRate: config.PTZSerialPortSettings.baudRate,
    parity:   config.PTZSerialPortSettings.parity,
    dataBits: config.PTZSerialPortSettings.dataBits,
    stopBits: config.PTZSerialPortSettings.stopBits,
    }
  );
 
  var stream = serialPort.on("open", function(err){
    if (err) {
      console.log('Error: '+err);
      return;
    } else {
      pelcod = new PelcoD(stream);
      pelcod.setAddress(config.PTZCameraAddress);
    }
  });
}

function ptz_callback(command: string, data: any) {
  if (command==='gotohome') {
   console.log("Goto Home");
   if (pelcod) pelcod.sendGotoPreset(1); // use preset 1 for Home
  }
  if (command==='sethome') {
   console.log("SetHome ");
   if (pelcod) pelcod.sendSetPreset(1); // use preset 1 for Home
  }
  if (command==='gotopreset') {
   console.log("Goto Preset "+ data.name + ' / ' + data.value);
   if (tenx) tenx.fire();
   if (pelcod) pelcod.sendGotoPreset(parseInt(data.value));
  }
  if (command==='setpreset') {
   console.log("Set Preset "+ data.name + ' / ' + data.value);
   if (pelcod) pelcod.sendSetPreset(parseInt(data.value));
  }
  if (command==='clearpreset') {
   console.log("Clear Preset "+ data.name + ' / ' + data.value);
   if (pelcod) pelcod.sendClearPreset(parseInt(data.value));
  }
  if (command==='aux') {
    console.log("Aux "+ data.name);
    if (pelcod) {
      if (data.name === 'AUX1on') pelcod.sendSetAux(1);
      if (data.name === 'AUX1off') pelcod.sendClearAux(1);
      if (data.name === 'AUX2on') pelcod.sendSetAux(2);
      if (data.name === 'AUX2off') pelcod.sendClearAux(2);
      if (data.name === 'AUX3on') pelcod.sendSetAux(3);
      if (data.name === 'AUX3off') pelcod.sendClearAux(3);
      if (data.name === 'AUX4on') pelcod.sendSetAux(4);
      if (data.name === 'AUX4off') pelcod.sendClearAux(4);
      if (data.name === 'AUX5on') pelcod.sendSetAux(5);
      if (data.name === 'AUX5off') pelcod.sendClearAux(5);
      if (data.name === 'AUX6on') pelcod.sendSetAux(6);
      if (data.name === 'AUX6off') pelcod.sendClearAux(6);
      if (data.name === 'AUX7on') pelcod.sendSetAux(7);
      if (data.name === 'AUX7off') pelcod.sendClearAux(7);
      if (data.name === 'AUX8on') pelcod.sendSetAux(8);
      if (data.name === 'AUX8off') pelcod.sendClearAux(8);
    }
  }
  if (command==='ptz') {
    console.log("PTZ "+ data.pan + ' ' + data.tilt + ' ' + data.zoom);
    var p=0.0;
    var t=0.0;
    var z=0.0;
    try {p = parseFloat(data.pan)} catch (err) {}
    try {t = parseFloat(data.tilt)} catch (err) {}
    try {z = parseFloat(data.zoom)} catch (err) {}
    if (tenx) {
      if      (p < -0.1 && t >  0.1) tenx.upleft();
      else if (p >  0.1 && t >  0.1) tenx.upright();
      else if (p < -0.1 && t < -0.1) tenx.downleft();
      else if (p >  0.1 && t < -0.1) tenx.downright();
      else if (p >  0.1) tenx.right();
      else if (p < -0.1) tenx.left();
      else if (t >  0.1) tenx.up();
      else if (t < -0.1) tenx.down()
      else tenx.stop();
    }
    if (pelcod) {
      pelcod.up(false).down(false).left(false).right(false);
      if      (p < 0 && t > 0) pelcod.up(true).left(true);
      else if (p > 0 && t > 0) pelcod.up(true).right(true);
      else if (p < 0 && t < 0) pelcod.down(true).left(true);
      else if (p > 0 && t < 0) pelcod.down(true).right(true);
      else if (p > 0) pelcod.right(true);
      else if (p < 0) pelcod.left(true);
      else if (t > 0) pelcod.up(true);
      else if (t < 0) pelcod.down(true);

      // Set Pan/Tilt speed
      // scale speeds from 0..1 to 0..63
      var pan_speed = Math.round(Math.abs(p) * 63.0 );
      var tilt_speed = Math.round(Math.abs(t) * 63.0 );

      pelcod.setPanSpeed(pan_speed);
      pelcod.setTiltSpeed(tilt_speed);


      pelcod.zoomIn(false).zoomOut(false);
      if (z>0) pelcod.zoomIn(true);
      if (z<0) pelcod.zoomOut(true);

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
        if (z != 0) pelcod.sendSetZoomSpeed(zoom_speed);
      } catch (err) {}

      pelcod.send();
    }
  }
}
