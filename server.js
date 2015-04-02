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

var fs = require("fs");
var soap = require('./lib/soap');
var http = require('http');
var url = require('url');

var Config = require('./config').Config;
var DeviceService = require('./DeviceService').DeviceService;
var MediaService = require('./MediaService').MediaService;

var DEBUG = Config.Debug;
var debugLog = function (){
    if (DEBUG)
        console.log.apply(this, arguments);
}

var ignoreNamespaces = [];

server = http.createServer(function (request, response) {
    debugLog('web request received : %s', request.url);
    var request = url.parse(request.url, true);
    var action = request.pathname;
    if (action == '/web/snapshot.jpg') {
        var img = fs.readFileSync('./web/snapshot.jpg');
        response.writeHead(200, { 'Content-Type': 'image/jpg' });
        response.end(img, 'binary');
    } else {
        response.end("404: Not Found: " + request);
    }
});

console.log("Starting webserver on port:" + Config.ServicePort);
server.listen(Config.ServicePort);

console.log("Binding device_service to '/onvif/device_service'");
soap.listen(server, { path : '/onvif/device_service', services : DeviceService, xml : DeviceService.wsdl, ignoredNamespaces : { namespaces : ignoreNamespaces } }).log = function (type, data) {
    debugLog('device_service - Calltype : %s, Data : %s', type, data);
};

console.log("Binding media_service to '/onvif/media_service'");
soap.listen(server, { path : '/onvif/media_service', services : MediaService, xml : MediaService.wsdl, ignoredNamespaces : { namespaces : ignoreNamespaces } }).log = function (type, data) {
    debugLog('media_service - Calltype : %s, Data : %s', type, data);
};
console.log("Running.");