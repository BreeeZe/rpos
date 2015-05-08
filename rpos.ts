/// <reference path="typings/rpos/rpos.d.ts"/>
/// <reference path="typings/tsd.d.ts"/>

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

device_service.start();
media_service.start();