﻿import { Utils } from './utils';
import fs = require('fs');
import parser = require('body-parser');
import { ChildProcess } from 'child_process';
import { v4l2ctl } from './v4l2ctl';
import { RposConfig } from './config';

export interface Resolution {
  Width: number;
  Height: number;
}
export interface CameraSettingsParameter {
  gop: number; //keyframe every X sec.
  resolution: Resolution;
  framerate: number;
  bitrate: number;
  profile: string;
  quality: number;
}
export interface CameraSettingsBase {
  forceGop: boolean; // Use iframe interval setting from v4l2ctl.json instead of Onvif
  resolution: Resolution;
  framerate: number;
}

export class Camera {
  options = {
    resolutions: <Resolution[]>[
      { Width: 640, Height: 480 },
      { Width: 800, Height: 600 },
      { Width: 1024, Height: 768 },
      { Width: 1280, Height: 1024 },
      { Width: 1280, Height: 720 },
      { Width: 1640, Height: 1232 },
      { Width: 1920, Height: 1080 }
    ],
    framerates: [2, 5, 10, 15, 25, 30],
    bitrates: [
      250,
      500,
      1000,
      2500,
      5000,
      7500,
      10000,
      12500,
      15000,
      17500
    ]
  }

  settings: CameraSettingsBase = {
    forceGop: true,
    resolution: <Resolution>{ Width: 1280, Height: 720 },
    framerate: 25,
  }

  config: RposConfig;
  rtspServer: ChildProcess;
  webserver: any;

  constructor(config: RposConfig, webserver: any) {
    this.config = config;
    this.rtspServer = null;
    if (this.config.RTSPServer != 0) {
      if (this.config.CameraType == 'usbcam') {
        if (this.config.RTSPServer != 3) {
          // Only GStreamer RTSP is supported now
          console.log('Only GStreamer RTSP mode is supported for USB Camera video');
          process.exit(1);
        }
        if (!fs.existsSync(this.config.CameraDevice)) {
          // USB cam is not found
          console.log(`USB Camera is not found at ${this.config.CameraDevice}`);
          process.exit(1);
        }
      }
      if (this.config.CameraType == 'filesrc') {
        if (this.config.RTSPServer != 3) {
          // Only GStreamer RTSP is supported now
          console.log('Only GStreamer RTSP mode is supported for File Source video');
          process.exit(1);
        }
        if (!fs.existsSync(this.config.CameraDevice)) {
          // Filename of image to show in RTSP stream is not found
          console.log(`Filesrc file is not found at ${this.config.CameraDevice}`);
          process.exit(1);
        }
      }
      if (this.config.CameraType == 'testsrc') {
        if (this.config.RTSPServer != 3) {
          // Only GStreamer RTSP is supported now
          console.log('Only GStreamer RTSP mode is supported for Test Source video');
          process.exit(1);
        }
      }
      if (this.config.CameraType == 'picam') {
        if (!fs.existsSync("/dev/video0")) {
          // this.loadDriver();
          if (Utils.isPi()) {
            // Needs a V4L2 Driver to be installed
            console.log('Use modprobe to load the Pi Camera V4L2 driver');
            console.log('e.g.   sudo modprobe bcm2835-v4l2');
            console.log('       or the uv4l driver');
            process.exit(1);
          }
        }
      }
    }
    this.webserver = webserver;

    this.setupWebserver();
    this.setupCamera();

    v4l2ctl.ReadControls();

    Utils.cleanup(() => {
      this.stopRtsp();
      var stop = new Date().getTime() + 2000;
      while (new Date().getTime() < stop) {
        //wait for rtsp server to stop
        ;
      }
      //      this.unloadDriver();
    });

    if (this.config.RTSPServer == 1) fs.chmodSync("./bin/rtspServer", "0755");
  }

  setupWebserver() {
    Utils.log.info("Starting camera settings webserver on http://%s:%s/", Utils.getIpAddress(), this.config.ServicePort);
    this.webserver.use(parser.urlencoded({ extended: true }));
    this.webserver.engine('ntl', (filePath, options, callback) => {
      this.getSettingsPage(filePath, callback);
    });
    this.webserver.set('views', './views'); // specify the views directory
    this.webserver.set('view engine', 'ntl'); // register the template engine
    this.webserver.get('/', (req, res) => {
      res.render('camera', {});
    });
    this.webserver.post('/', (req, res) => {
      for (var par in req.body) {
        var g = par.split('.')[0];
        var p = par.split('.')[1];
        if (p && g) {
          var prop = <v4l2ctl.UserControl<any>>v4l2ctl.Controls[g][p];
          var val = req.body[par];
          if (val instanceof Array)
            val = (<any[]>val).pop();
          prop.value = val;
          if (prop.isDirty) {
            Utils.log.debug("Property %s changed to %s", par, prop.value);
          }
        }
      }
      v4l2ctl.ApplyControls();
      res.render('camera', {});
    });
  }

  getSettingsPage(filePath, callback) {
    v4l2ctl.ReadControls();
    fs.readFile(filePath, (err, content) => {
      if (err)
        return callback(new Error(err.message));

      var parseControls = (html: string, displayname: string, propname: string, controls: Object) => {
        html += `<tr><td colspan="2"><strong>${displayname}</strong></td></tr>`;
        for (var uc in controls) {
          var p = <v4l2ctl.UserControl<any>>controls[uc];
          if (p.hasSet) {
            var set = p.getLookupSet();
            html += `<tr><td><span class="label">${uc}</span></td><td><select name="${propname}.${uc}">`;
            for (let o of set) {
              html += `<option value="${o.value}" ${o.value == p.value ? 'selected="selected"' : ''}>${o.desc}</option>`;
            }
            html += '</select></td></tr>';

          } else if (p.type == "Boolean") {
            html += `<tr><td><span class="label">${uc}</span></td>
              <td><input type="hidden" name="${propname}.${uc}" value="false" />
              <input type="checkbox" name="${propname}.${uc}" value="true" ${p.value ? 'checked="checked"' : ''}/></td><tr>`;
          } else {
            html += `<tr><td><span class="label">${uc}</span></td>
              <td><input type="text" name="${propname}.${uc}" value="${p.value}" />`
            if (p.hasRange)
              html += `<span>( min: ${p.getRange().min} max: ${p.getRange().max} )</span>`
            html += `</td><tr>`;
          }
        }
        return html;
      }

      var html = "<h1>RPOS - ONVIF NVT Camera</h1>";
      html += "<b>Video Stream:</b> rtsp://username:password@deviceIPaddress:" + this.config.RTSPPort.toString() + "/" + this.config.RTSPName.toString();
      html += "<br>";

      html = parseControls(html, 'User Controls', 'UserControls', v4l2ctl.Controls.UserControls);
      html = parseControls(html, 'Codec Controls', 'CodecControls', v4l2ctl.Controls.CodecControls);
      html = parseControls(html, 'Camera Controls', 'CameraControls', v4l2ctl.Controls.CameraControls);
      html = parseControls(html, 'JPG Compression Controls', 'JPEGCompressionControls', v4l2ctl.Controls.JPEGCompressionControls);

      var rendered = content.toString().replace('{{row}}', html);
      return callback(null, rendered);
    })
  }

  loadDriver() {
    try {
      Utils.execSync("sudo modprobe bcm2835-v4l2"); // only on PI, and not needed with USB Camera
    } catch (err) { }
  }

  unloadDriver() {
    try {
      Utils.execSync("sudo modprobe -r bcm2835-v4l2");
    } catch (err) { }
  }

  setupCamera() {
    v4l2ctl.SetPixelFormat(v4l2ctl.Pixelformat.H264)
    v4l2ctl.SetResolution(this.settings.resolution);
    v4l2ctl.SetFrameRate(this.settings.framerate);
    v4l2ctl.SetPriority(v4l2ctl.ProcessPriority.record);
    v4l2ctl.ReadFromFile();
    v4l2ctl.ApplyControls();
  }

  setSettings(newsettings: CameraSettingsParameter) {
    v4l2ctl.SetResolution(newsettings.resolution);
    v4l2ctl.SetFrameRate(newsettings.framerate);

    v4l2ctl.Controls.CodecControls.video_bitrate.value = newsettings.bitrate * 1000;
    v4l2ctl.Controls.CodecControls.video_bitrate_mode.value = newsettings.quality > 0 ? 0 : 1;
    v4l2ctl.Controls.CodecControls.h264_i_frame_period.value = this.settings.forceGop ? v4l2ctl.Controls.CodecControls.h264_i_frame_period.value : newsettings.gop;
    v4l2ctl.ApplyControls();
  }

  startRtsp() {
    if (this.rtspServer) {
      Utils.log.warn("Cannot start rtspServer, already running");
      return;
    }
    Utils.log.info("Starting rtsp server");

    if (this.config.MulticastEnabled) {
      this.rtspServer = Utils.spawn("v4l2rtspserver", ["-P", this.config.RTSPPort.toString(), "-u", this.config.RTSPName.toString(), "-m", this.config.RTSPMulticastName, "-M", this.config.MulticastAddress.toString() + ":" + this.config.MulticastPort.toString(), "-W", this.settings.resolution.Width.toString(), "-H", this.settings.resolution.Height.toString(), "/dev/video0"]);
    } else {
      if (this.config.RTSPServer == 1) this.rtspServer = Utils.spawn("./bin/rtspServer", ["/dev/video0", "2088960", this.config.RTSPPort.toString(), "0", this.config.RTSPName.toString()]);
      if (this.config.RTSPServer == 2) this.rtspServer = Utils.spawn("v4l2rtspserver", ["-P", this.config.RTSPPort.toString(), "-u", this.config.RTSPName.toString(), "-W", this.settings.resolution.Width.toString(), "-H", this.settings.resolution.Height.toString(), "/dev/video0"]);
      if (this.config.RTSPServer == 3) this.rtspServer = Utils.spawn("./python/gst-rtsp-launch.sh", ["-P", this.config.RTSPPort.toString(), "-u", this.config.RTSPName.toString(), "-W", this.settings.resolution.Width.toString(), "-H", this.settings.resolution.Height.toString(), "-t", this.config.CameraType, "-d", (this.config.CameraDevice == "" ? "auto" : this.config.CameraDevice)]);
    }

    if (this.rtspServer) {
      this.rtspServer.stdout.on('data', data => Utils.log.debug("rtspServer: %s", data));
      this.rtspServer.stderr.on('data', data => Utils.log.error("rtspServer: %s", data));
      this.rtspServer.on('error', err => Utils.log.error("rtspServer error: %s", err));
      this.rtspServer.on('exit', (code, signal) => {
        if (code)
          Utils.log.error("rtspServer exited with code: %s", code);
        else
          Utils.log.debug("rtspServer exited")
      });
    }
  }

  stopRtsp() {
    if (this.rtspServer) {
      Utils.log.info("Stopping rtsp server");
      this.rtspServer.kill();
      this.rtspServer = null;
    }
  }
}