﻿/*
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

/* 
 * WS-Discovery
 * Listens on Port 3702 on 239.255.255.250 for UDP WS-Discovery Messages
 * and sends back a reply containing the ONVIF Xaddr
 *
 * Raspberry Pi: Works fine.

 * Windows: Works, after I was able to make the UDP port non exclusive with reuseAddr
 * as Winodws also listens on that port.
 *
 * Mac: OS 10.10 worked but only if you ran it as root. Seems that a process
 * called SpotlightNetHelper takes the address.
 * Mac: OS 10.11 did not work (even as root)
 * 
 */

import * as dgram from "dgram";
import * as uuid from "node-uuid";
import * as xml2js from 'xml2js';
import { RposConfig } from '../lib/config';
import { Utils } from '../lib/utils';

export class DiscoveryService {

  constructor(private config: RposConfig) {}


  start() {

    //    if (process.platform != 'linux') {
    //      utils.log.info("discovery_service not started (requires linux)");
    //      return;
    //    }
    var opts: dgram.SocketOptions = {
      type: 'udp4',
      reuseAddr: true
    };
    var discover_socket = dgram.createSocket(opts);
    var reply_socket    = dgram.createSocket('udp4');

    discover_socket.on('error', (err) => {
      throw err;
    });

    discover_socket.on('message', (received_msg, rinfo) => {

      Utils.log.debug("Discovery received from " + rinfo.address);

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

          let reply = `<?xml version="1.0" encoding="UTF-8"?>
          <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
            <SOAP-ENV:Header>
              <wsa:MessageID>uuid:${uuid.v1()}</wsa:MessageID>
              <wsa:RelatesTo>${probe_uuid}</wsa:RelatesTo>
              <wsa:To SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</wsa:To>
              <wsa:Action SOAP-ENV:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches</wsa:Action>
              <d:AppSequence SOAP-ENV:mustUnderstand="true" MessageNumber="68" InstanceId="1460972484"/>
            </SOAP-ENV:Header>
            <SOAP-ENV:Body>
              <d:ProbeMatches>
                <d:ProbeMatch>
                  <wsa:EndpointReference>
                    <wsa:Address>urn:uuid:${Utils.uuid5(Utils.getIpAddress() + this.config.ServicePort + this.config.RTSPPort)}</wsa:Address>
                  </wsa:EndpointReference>
                  <d:Types>dn:NetworkVideoTransmitter</d:Types>
                  <d:Scopes>
                    onvif://www.onvif.org/type/video_encoder
                    onvif://www.onvif.org/type/ptz
                    onvif://www.onvif.org/hardware/${encodeURIComponent(this.config.DeviceInformation.Model)}
                    onvif://www.onvif.org/name/${encodeURIComponent(this.config.DeviceInformation.Manufacturer + ' ' + this.config.DeviceInformation.Model)}
                    onvif://www.onvif.org/location/
                  </d:Scopes>
                  <d:XAddrs>http://${Utils.getIpAddress()}:${this.config.ServicePort}/onvif/device_service</d:XAddrs>
                  <d:MetadataVersion>1</d:MetadataVersion>
              </d:ProbeMatch>
              </d:ProbeMatches>
            </SOAP-ENV:Body>
          </SOAP-ENV:Envelope>`;

          let reply_bytes = Buffer.from(reply);

          // Mac needed replies from a different UDP socket (ie not the bounded socket)
          return reply_socket.send(reply_bytes, 0, reply_bytes.length, rinfo.port, rinfo.address);
        }
      });
    });

    discover_socket.bind(3702, () => {
      return discover_socket.addMembership('239.255.255.250');
    });

    Utils.log.info("discovery_service started");

  };

} // end class Discovery