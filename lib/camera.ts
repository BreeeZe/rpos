///<reference path="../typings/main.d.ts"/>
///<reference path="../rpos.d.ts"/>
import { Utils }  from './utils';
import fs = require('fs');
import parser = require('body-parser');
import { ChildProcess } from 'child_process';
import { v4l2ctl } from './v4l2ctl';

var utils = Utils.utils;

class Camera {
  options = {
    resolutions: <Resolution[]>[
      { Width: 640, Height: 480 },
      { Width: 800, Height: 600 },
      { Width: 1024, Height: 768 },
      { Width: 1280, Height: 1024 },
      { Width: 1280, Height: 720 },
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
  
  config: rposConfig;
  rtspServer: ChildProcess;
  webserver: any;

  constructor(config: rposConfig, webserver: any) {
    this.config = config;
    this.rtspServer = null;
    this.loadDriver();
    this.webserver = webserver;

    this.setupWebserver();
    this.setupCamera();

    v4l2ctl.ReadControls();

    utils.cleanup(() => {
      this.stopRtsp();
      var stop = new Date().getTime() + 2000;
      while (new Date().getTime() < stop) {
        //wait for rtsp server to stop
        ;
      }
      this.unloadDriver();
    });

    if (this.config.RTSPServer == 1 )fs.chmodSync("./bin/rtspServer", "0755");
  }
  setupWebserver() {
    utils.log.info("Starting camera settings webserver on http://%s:%s/", utils.getIpAddress(), this.config.ServicePort);
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
            utils.log.debug("Property %s changed to %s", par, prop.value);
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

      var html = parseControls("", 'User Controls', 'UserControls', v4l2ctl.Controls.UserControls);
      html = parseControls(html, 'Codec Controls', 'CodecControls', v4l2ctl.Controls.CodecControls);
      html = parseControls(html, 'Camera Controls', 'CameraControls', v4l2ctl.Controls.CameraControls);
      html = parseControls(html, 'JPG Compression Controls', 'JPEGCompressionControls', v4l2ctl.Controls.JPEGCompressionControls);

      var rendered = content.toString().replace('{{row}}', html);
      return callback(null, rendered);
    })
  }

  loadDriver() {
    utils.execSync("sudo modprobe bcm2835-v4l2");
  }
  
  unloadDriver(){
    utils.execSync("sudo modprobe -r bcm2835-v4l2");
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
      utils.log.warn("Cannot start rtspServer, already running");
      return;
    }
    utils.log.info("Starting Live555 rtsp server");

    if (this.config.RTSPServer == 1) this.rtspServer = utils.spawn("./bin/rtspServer", ["/dev/video0", "2088960", this.config.RTSPPort.toString(), "0", this.config.RTSPName.toString()]);
    if (this.config.RTSPServer == 2) this.rtspServer = utils.spawn("h264_v4l2_rtspserver", ["-P",this.config.RTSPPort.toString(), "-u" , this.config.RTSPName.toString(),"-W",this.settings.resolution.Width.toString(),"-H",this.settings.resolution.Height.toString(),"/dev/video0"]);

    this.rtspServer.stdout.on('data', data => utils.log.debug("rtspServer: %s", data));
    this.rtspServer.stderr.on('data', data => utils.log.error("rtspServer: %s", data));
    this.rtspServer.on('error', err=> utils.log.error("rtspServer error: %s", err));
    this.rtspServer.on('exit', (code, signal) => {
      if (code)
        utils.log.error("rtspServer exited with code: %s", code);
      else
        utils.log.debug("rtspServer exited")
    });
  }

  stopRtsp() {
    if (this.rtspServer) {
      utils.log.info("Stopping Live555 rtsp server");
      this.rtspServer.kill();
      this.rtspServer = null;
    }
  }
}

export = Camera;
