///<reference path="../typings/tsd.d.ts"/>
///<reference path="../typings/rpos/rpos.d.ts"/>
import { utils, logLevel }  from './utils';
import fs = require('fs');
import parser = require('body-parser');
import { ChildProcess } from 'child_process';
import v4l2 = require('./v4l2ctl');


class Camera {
  config: rposConfig;
  rtspServer: ChildProcess;
  webserver: any;

  constructor(config: rposConfig, webserver: any) {
    this.config = config;
    this.rtspServer = null;
    this.load();
    this.webserver = webserver;

    this.setupWebserver();
    this.setupCamera();

    v4l2.GetControls();

    utils.cleanup(() => {
      this.stopRtsp();
      var stop = new Date().getTime() + 2000;
      while (new Date().getTime() < stop) {
        //wait for rtsp server to stop
        ;
      }
      utils.execSync("sudo modprobe -r bcm2835-v4l2");
    });
    fs.chmodSync("./bin/rtspServer", "0755");
  }
  setupWebserver() {
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
          var prop = <v4l2.UserControl<any>>v4l2.Controls[g][p];
          var val = req.body[par];
          if (val instanceof Array)
            val = (<any[]>val).pop();
          prop.value = val;
          if (prop.isDirty {
            utils.log.debug("Property %s changed to %s", par, prop.value);
          }
        }
      }
      v4l2.SetControls();
      res.render('camera', {});
    });
  }

  getSettingsPage(filePath, callback) {
    v4l2.GetControls();
    fs.readFile(filePath, (err, content) => {
      if (err)
        return callback(new Error(err.message));

      var parseControls = (html, displayname, propname, controls) => {
        html += `<tr><td colspan="2"><strong>${displayname}</strong></td></tr>`;
        for (var uc in controls) {
          var p = <v4l2.UserControl<any>>controls[uc];
          if (p.hasSet) {
            var set = p.getLookupSet();
            html += `<tr><td><span class="label">${uc}</span></td><td><select name="${propname}.${uc}">`;
            for (let o of set) {
              html += `<option value="${o.value}" ${o.value == p.value ? 'selected="selected"' : ''}>${o.lookup}</option>`;
            }
            html += '</select></td></tr>';

          } else if (p.type == "Boolean") {
            html += `<tr><td><span class="label">${uc}</span></td>
              <td><input type="hidden" name="${propname}.${uc}" value="false" />
              <input type="checkbox" name="${propname}.${uc}" value="true" ${p.value ? 'checked="checked"' : ''}/></td><tr>`;
          } else {
            html += `<tr><td><span class="label">${uc}</span></td>
              <td><input type="text" name="${propname}.${uc}" value="${p.value}" /></td><tr>`;
          }
        }
        return html;
      }

      var html = parseControls("", 'User Controls', 'UserControls', v4l2.Controls.UserControls);
      html = parseControls(html, 'Codec Controls', 'CodecControls', v4l2.Controls.CodecControls);
      html = parseControls(html, 'Camera Controls', 'CameraControls', v4l2.Controls.CameraControls);
      html = parseControls(html, 'JPG Compression Controls', 'JPEGCompressionControls', v4l2.Controls.JPEGCompressionControls);

      var rendered = content.toString().replace('{{row}}', html);
      return callback(null, rendered);
    })
  }

  load() {
    utils.execSync("sudo modprobe bcm2835-v4l2");
  }

  setupCamera() {

    utils.execSync(
      `sudo v4l2-ctl --set-fmt-video=width=${this.settings.resolution.Width},height=${this.settings.resolution.Height},pixelformat=4`);

    utils.execSync(
      `sudo v4l2-ctl --set-parm=${this.settings.framerate}`);

  }

  setSettings(newsettings) {
    utils.execSync(
      `sudo v4l2-ctl --set-fmt-video=width=${newsettings.resolution.Width},height=${newsettings.resolution.Height},pixelformat=4`);

    utils.execSync("sudo v4l2-ctl --set-ctrl " +
      `video_bitrate=${(newsettings.bitrate * 1000) }` +
      `,video_bitrate_mode=${(newsettings.quality > 0 ? 0 : 1) }` +
      `,h264_i_frame_period=${(this.settings.forceGop ? this.settings.gop : newsettings.gop) }` +
      `,horizontal_flip=${(this.settings.hf ? 1 : 0) }` +
      `,vertical_flip=${(this.settings.vf ? 1 : 0) }`);

    utils.execSync(`sudo v4l2-ctl --set-parm=${newsettings.frameRate}`);
  }

  startRtsp(input) {
    if (this.rtspServer) {
      utils.log.warn("Cannot start rtspServer, already running");
      return;
    }
    utils.log.info("Starting Live555 rtsp server");

    this.rtspServer = utils.spawn("./bin/rtspServer", [input, "2088960", this.config.RTSPPort, 0, this.config.RTSPName]);

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
  
  options = {
    resolutions: [
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
    ],
    quality: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    profiles: ["Baseline", "Main", "High"]
  };

  settings = {
    hf: false, //horizontal flip
    vf: true, //vertical flip
    drc: 2, //0=OFF, 1=LOW, 2=MEDIUM, 3=HIGH
    gop: 2, //keyframe every X sec.
    forceGop: true,
    resolution: { Width: 1280, Height: 720 },
    framerate: 25,
    bitrate: 7500,
    profile: "Baseline",
    quality: null,
    exposure: "auto"
  };
}

export = Camera;