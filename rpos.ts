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
import "./lib/extension";
import * as http from "http";
import * as express from "express";
import { Utils, logLevel } from "./lib/utils";
import { Camera } from "./lib/camera";
import { DeviceService } from "./services/device_service";
import { MediaService } from "./services/media_service";
import { DiscoveryService } from "./services/discovery_service";

let pjson = require("./package.json");
let config = <rposConfig>require("./rposConfig.json");

Utils.log.level = <logLevel>config.logLevel;

config.DeviceInformation.SerialNumber = Utils.getSerial();
config.DeviceInformation.FirmwareVersion = pjson.version;
Utils.setConfig(config);
Utils.testIpAddress();

for (var i in config.DeviceInformation) {
  Utils.log.info("%s : %s", i, config.DeviceInformation[i]);
}

let webserver = express();
let httpserver = http.createServer(webserver);

let camera = new Camera(config, webserver);
let device_service = new DeviceService(config, httpserver);
let media_service = new MediaService(config, httpserver, camera);
let discovery_service = new DiscoveryService(config);

device_service.start();
media_service.start();
discovery_service.start();