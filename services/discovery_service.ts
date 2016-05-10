/// <reference path="../typings/rpos/rpos.d.ts"/>
/// <reference path="../typings/tsd.d.ts"/>

/*
The MIT License(MIT)

Copyright(c) 2016 Roger Hardiman

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

/* WS-Discovery */
/* Listens on Port 3702 on 239.255.255.0 for UDP WS-Discovery Messages */

import dgram = require('dgram');
import uuid = require('node-uuid');
import xml2js = require('xml2js');
import { Utils } from '../lib/utils';
var utils = Utils.utils;

class DiscoveryService {

  config: rposConfig;

  constructor(config: rposConfig) {
    this.config = config;
  }


  start() {
    var discover_socket = dgram.createSocket('udp4');

    discover_socket.on('error', (err) => {
      throw err;
    });

    discover_socket.on('message', (received_msg, rinfo) => {

      utils.log.debug("Discovery received");

      // Filter xmlns namespaces from XML before calling XML2JS
      let filtered_msg = received_msg.toString().replace(/xmlns(.*?)=(".*?")/g, '');

      var parseString = xml2js.parseString;
      var strip = xml2js['processors'].stripPrefix;
      parseString(filtered_msg, { tagNameProcessors: [strip] }, (err, result) => {
        let probe_uuid = result['Envelope']['Header'][0]['MessageID'][0];
        let probe_type = "";
        try {
          probe_type = result['Envelope']['Body'][0]['Probe'][0]['Types'][0];
        } catch (err) {
          probe_type = ""; // For a VMS that does not send Types
        }

        if (probe_type === "" || probe_type.indexOf("NetworkVideoTransmitter") > -1) {

          let reply = 
	'<?xml version="1.0" encoding="UTF-8"?>' +
        '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">'+
	'<SOAP-ENV:Header>'+
	  '<wsa:MessageID>REPLACE_MESSAGE_ID</wsa:MessageID>'+
	  '<wsa:RelatesTo>REPLACE_RELATES_TO</wsa:RelatesTo>'+
	  '<wsa:To SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>'+
	  '<wsa:Action SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>'+
          '<d:AppSequence SOAP-ENV:mustUnderstand="true" MessageNumber="68" InstanceId="1460972484"/>'+
	'</SOAP-ENV:Header>'+
	'<SOAP-ENV:Body>'+
	  '<d:ProbeMatches>'+
            '<d:ProbeMatch>'+
	      '<wsa:EndpointReference>'+
		'<wsa:Address>REPLACE_ENDPOINT_UUID</wsa:Address>'+
		'</wsa:EndpointReference>'+
		'<d:Types>dn:NetworkVideoTransmitter</d:Types>'+
		'<d:Scopes>REPLACE_SCOPES</d:Scopes>'+
		'<d:XAddrs>REPLACE_XADDR_SERVICE</d:XAddrs>'+
		'<d:MetadataVersion>1</d:MetadataVersion>'+
	'</d:ProbeMatch>'+
	'</d:ProbeMatches>'+
	'</SOAP-ENV:Body>'+
        '</SOAP-ENV:Envelope>'
	;

        // Populate the XML reply 
        reply = reply.replace("REPLACE_RELATES_TO",probe_uuid);
        reply = reply.replace("REPLACE_MESSAGE_ID",'uuid:' + uuid.v1()); // time based uuid
        reply = reply.replace("REPLACE_ENDPOINT_UUID",'urn:uuid:' + uuid5(this.config.IpAddress + this.config.ServicePort + this.config.RTSPPort));
        reply = reply.replace("REPLACE_XADDR_SERVICE","http://"+this.config.IpAddress + ":" + this.config.ServicePort + "/onvif/device_service");
        reply = reply.replace("REPLACE_SCOPES","onvif://www.onvif.org/type/video_encoder onvif://www.onvif.org/type/ptz   onvif://www.onvif.org/hardware/RaspberryPI onvif://www.onvif.org/name/PI onvif://www.onvif.org/location/" );

          let reply_bytes = new Buffer(reply);
          return discover_socket.send(reply_bytes, 0, reply_bytes.length, rinfo.port, rinfo.address);
        }
      });
    });

    discover_socket.bind(3702, '239.255.255.250', () => {
      discover_socket.addMembership('239.255.255.250');
    });

    utils.log.info("discovery_service started");

  };

} // end class Discovery

export = DiscoveryService;