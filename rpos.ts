/// <reference path="./rpos.d.ts"/>

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
import PTZDriver = require("./lib/PTZDriver");
import DeviceService = require("./services/device_service");
import MediaService = require("./services/media_service");
import PTZService = require("./services/ptz_service");
import ImagingService = require("./services/imaging_service");
import DiscoveryService = require("./services/discovery_service");

var utils = Utils.utils;
let pjson = require("./package.json");
const os = require('os');

import fs = require('fs');
import { exit } from "process";


let configFile = './rposConfig.json';
let instanceID = null;
let serviceCommand = null;

// process the command line arguments
let args = [...process.argv];

args.shift(); // pop exe name (eg node.exe)
args.shift(); // pop script name

while (args.length >= 2) {
  if (args[0] == '-instance') instanceID = Number(args[1]);
  if (args[0] == '-config') configFile = args[1];
  if (args[0] == '-service') serviceCommand = args[1];
  args.shift();
  args.shift();
}

// validate
if (serviceCommand != null && instanceID == null) {
  console.log('Error - services require an instance ID')
  exit();
}
if (serviceCommand == null && instanceID != null) {
  console.log('Error - Instance ID must be used with a Service Command')
  exit();
}
if (serviceCommand != null && instanceID != null) {
  // load the config file for this instance
  configFile = "./rposConfigInstance" + instanceID + ".json"
}

const Service = require('node-windows').Service

// Create a new service object
const svc = new Service({
  name: 'SMOTS ONVIF Link ' + instanceID,
  description:
    'ONVIF Wrapper for Video Cameras',
  script: 'rpos.js',
  scriptOptions: '-c rposConfigInstance' + instanceID + '.json'
})

svc.on('install', () => {
  console.log('Service installation complete.')
  svc.start()
})

svc.on('uninstall', () => {
  console.log('Uninstall complete.')
})

svc.on('alreadyinstalled', () => {
  console.error('This service is already installed.')
})

svc.on('invalidinstallation ', () => {
  console.error('Installation was detected but missing required files.')
})

svc.on('error', err => {
  console.error('There was an error with the installation!')
  console.error(err)
})

svc.on('start', () => {
  console.log(`${svc.name} started instance ` + instanceID)
})

// Arguments are either
//     node.exe    myscript.js   command1 command2 command2
// or  pkg-made.exe myscript.js   command1 command2 command2
if (serviceCommand == 'install' && instanceID != null) {
  svc.install()
}

// Note the different positions of the arguments for   node.exe   script.js   command1  
// and for                                             pkg-made-exe           command1
else if (serviceCommand == 'uninstall' && instanceID != null) {
  svc.uninstall();
}
else {
  // Load the Config File
  let data = fs.readFileSync(configFile, 'utf8');
  if (typeof data == 'string' && data.charCodeAt(0) === 0xFEFF) {
    data = data.slice(1); // strip off the utf8 BO marker bytes
  }
  let config = JSON.parse(data);

  utils.log.level = <Utils.logLevel>config.logLevel;

  // config.DeviceInformation has Manufacturer, Model, SerialNumer, FirmwareVersion, HardwareId
  // Probe hardware for values, unless they are given in rposConfig.json
  config.DeviceInformation = config.DeviceInformation || {};

  if (utils.isPi()) {
    var model = require('rpi-version')();
    if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS Raspberry Pi';
    if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = model;
  }

  if (utils.isMac()) {
    const macosRelease = require('macos-release');
    if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS AppleMac';
    if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = macosRelease()['name'] + ' ' + macosRelease()['version'];
  }

  if (utils.isWindows()) {
    if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS Windows';
    if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = os.version;
  }

  if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS';
  if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = 'RPOS';
  if (config.DeviceInformation.SerialNumber == undefined) config.DeviceInformation.SerialNumber = utils.getSerial();
  if (config.DeviceInformation.FirmwareVersion == undefined) config.DeviceInformation.FirmwareVersion = pjson.version;
  if (config.DeviceInformation.HardwareId == undefined) config.DeviceInformation.HardwareId = '1001';

  utils.setConfig(config);
  utils.testIpAddress();

  for (var i in config.DeviceInformation) {
    utils.log.info("%s : %s", i, config.DeviceInformation[i]);
  }

  let webserver = express();
  let httpserver = http.createServer(webserver);
  httpserver.listen(config.ServicePort);

  let ptz_driver = new PTZDriver(config);

  let camera = new Camera(config, webserver);
  let device_service = new DeviceService(config, httpserver, ptz_driver.process_ptz_command);
  let ptz_service = new PTZService(config, httpserver, ptz_driver.process_ptz_command, ptz_driver);
  let imaging_service = new ImagingService(config, httpserver, ptz_driver.process_ptz_command);
  let media_service = new MediaService(config, httpserver, camera, ptz_service); // note ptz_service dependency
  let discovery_service = new DiscoveryService(config);

  device_service.start();
  media_service.start();
  ptz_service.start();
  imaging_service.start();
  discovery_service.start();
}