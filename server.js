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

var utils = require('./lib/utils');
var pjson = require('./package.json');
var config = require('./config');
var http = require('http');
var express = require('express');

utils.log.level = config.logLevel;

config.DeviceInformation.SerialNumber = utils.getSerial();
config.DeviceInformation.FirmwareVersion = pjson.version;

for (var i in config.DeviceInformation) {
  utils.log.info("%s : %s", i , config.DeviceInformation[i]);
}

var webserver = express();
var httpserver = http.createServer(webserver);

var camera = new (require('./lib/camera'))(config, webserver);
var device_service = new (require('./services/device_service.js'))(config, httpserver);
var media_service = new (require('./services/media_service.js'))(config, httpserver, camera);

device_service.start();
media_service.start();