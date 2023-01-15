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
import "./lib/extension";

import * as http from "http";
import * as express from "express";
import { readFileSync } from 'fs';
import { Utils } from "./lib/utils";
import { Camera } from "./lib/camera";
import { exit } from "process";
import { version } from "os";
import { PTZDriver } from "./lib/PTZDriver";
import { DeviceService } from "./services/device_service";
import { ImagingService } from "./services/imaging_service";
import { MediaService } from "./services/media_service";
import { DiscoveryService } from "./services/discovery_service";
import { PTZService } from "./services/ptz_service";
import * as path from "path";
import { RposConfig } from "./lib/config";

const pjson = require("../package.json");
let configFile = path.join(__dirname, '../rposConfig.json');

let ptr = 0;
let remaining = process.argv.length;

// Skip over the executable name (eg node.exe) and the rpos.js script name
ptr += 2;
remaining -= 2;

// parse any other parameters
while (remaining > 0) {
  if (process.argv[ptr] == '--help' || process.argv[ptr] == '-h') {
    console.log("RPOS ONVIF Server\r\n");
    console.log("  -h  --help                      Show Commands");
    console.log("      --config <json filename>    Config Filename");
    exit();
  }
  else if (process.argv[ptr] == '--config' && remaining >= 2) {
    configFile = process.argv[ptr + 1];
    ptr += 2;
    remaining -= 2;
  } else {
    ptr += 1;
    remaining -= 1;
  }
}

// Load the Config File
let data = readFileSync(configFile, 'utf8');
if (typeof data == 'string' && data.charCodeAt(0) === 0xFEFF) {
  data = data.slice(1); // strip off the utf8 BO marker bytes
}
const config: RposConfig = JSON.parse(data);

Utils.log.level = config.logLevel;

// config.DeviceInformation has Manufacturer, Model, SerialNumer, FirmwareVersion, HardwareId
// Probe hardware for values, unless they are given in rposConfig.json
config.DeviceInformation = config.DeviceInformation || <any>{};

if (Utils.isPi()) {
  var model = require('rpi-version')();
  if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS Raspberry Pi';
  if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = model;
}

if (Utils.isMac()) {
  const macosRelease = require('macos-release');
  if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS AppleMac';
  if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = macosRelease()['name'] + ' ' + macosRelease()['version'];
}

if (Utils.isWindows()) {
  if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS Windows';
  if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = version();
}

if (config.DeviceInformation.Manufacturer == undefined) config.DeviceInformation.Manufacturer = 'RPOS';
if (config.DeviceInformation.Model == undefined) config.DeviceInformation.Model = 'RPOS';
if (config.DeviceInformation.SerialNumber == undefined) config.DeviceInformation.SerialNumber = Utils.getSerial();
if (config.DeviceInformation.FirmwareVersion == undefined) config.DeviceInformation.FirmwareVersion = pjson.version;
if (config.DeviceInformation.HardwareId == undefined) config.DeviceInformation.HardwareId = '1001';

Utils.setConfig(config);
Utils.testIpAddress();

for (var i in config.DeviceInformation) {
  Utils.log.info("%s : %s", i, config.DeviceInformation[i]);
}

const webserver = express();
const httpserver = http.createServer(webserver);
httpserver.listen(config.ServicePort);

const ptz_driver = new PTZDriver(config);

const camera = new Camera(config, webserver);
const device_service = new DeviceService(config, httpserver, ptz_driver.process_ptz_command);
const ptz_service = new PTZService(config, httpserver, ptz_driver.process_ptz_command, ptz_driver);
const imaging_service = new ImagingService(config, httpserver, ptz_driver.process_ptz_command);
const media_service = new MediaService(config, httpserver, camera, ptz_service); // note ptz_service dependency
const discovery_service = new DiscoveryService(config);

device_service.start();
media_service.start();
ptz_service.start();
imaging_service.start();
discovery_service.start();
