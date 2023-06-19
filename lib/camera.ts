///<reference path="../rpos.d.ts"/>

import { Utils }  from './utils';
import fs = require('fs');
import parser = require('body-parser');
import { ChildProcess, exec } from 'child_process';
import { v4l2ctl } from './v4l2ctl';
import { onExit } from 'signal-exit';

const DEFAULT_CAMERA_SETTINGS_FILE = './rpos-camera.json';
const SAVE_SETTINGS_DELAY_SECS = 30;
const H264_PROFILES = {
  'Baseline': 0,
  'Main': 2,
  'High': 4,
};
const H264_PROFILES_FROM_VALUE = {
  '0': 'Baseline',
  '2': 'Main',
  '4': 'High',
};

var utils = Utils.utils;

enum ServerState {
  Running,
  Restart,
  Stopped,
}

class Camera {
  resolution: Resolution = { Width: 1280, Height: 720 }
  framerate = 25

  config: rposConfig;
  rtspServer: ChildProcess;
  rtspServerState: ServerState;
  rtspServerBeforeStartHook: () => void | null;
  webserver: any;
  settingsFilename: string;
  saveTimeout: ReturnType<typeof setTimeout>;

  constructor(config: rposConfig, webserver: any) {
    this.config = config;
    this.saveTimeout = null;
    this.settingsFilename = config.CameraSettingsFilename ?? DEFAULT_CAMERA_SETTINGS_FILE;
    this.rtspServerState = ServerState.Stopped;
    this.rtspServerBeforeStartHook = null;
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
          if (utils.isPi()) {
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

    this.setupCamera();
    this.setupWebserver();

    onExit((code, signal) => {
      this.stopRtsp();
      if (this.saveTimeout) {
        clearInterval(this.saveTimeout);
        this.saveSettings(true);
      }
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
      const changed = v4l2ctl.ApplyControls();
      if (changed) {
        this.triggerSaveTimeout();
      }
      res.render('camera', {});
    });
  }

  getSettingsPage(filePath, callback) {
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

  setupCamera() {
    v4l2ctl.ReadControls();
    let settings = null;
    try {
      settings = JSON.parse(fs.readFileSync(this.settingsFilename).toString());
    } catch (e) {
      utils.log.error(`${this.settingsFilename} does not exist yet or is invalid.`);
    }
    if (settings?.v4l2ctl) {
      v4l2ctl.FromJson(settings.v4l2ctl);
      v4l2ctl.ApplyControls();
    }
    if (settings?.resolution) {
      this.resolution = settings.resolution;
    }
    if (settings?.framerate) {
      this.framerate = settings.framerate;
    }
    v4l2ctl.SetPixelFormat(v4l2ctl.Pixelformat.H264)
    v4l2ctl.SetPriority(v4l2ctl.ProcessPriority.record);
  }

  getOptions() {
    return {
      resolutions: <Resolution[]>[
        { Width: 640, Height: 480 },
        { Width: 800, Height: 600 },
        { Width: 1024, Height: 768 },
        { Width: 1280, Height: 1024 },
        { Width: 1280, Height: 720 },
        { Width: 1920, Height: 1080 }
      ],
      framerate: [2, 5, 10, 15, 25, 30],
      bitrate: [
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
      h264Profiles: Object.keys(H264_PROFILES),
      gop: {
        Min: v4l2ctl.Controls.CodecControls.h264_i_frame_period.getRange().min,
        Max: v4l2ctl.Controls.CodecControls.h264_i_frame_period.getRange().max
      },
      quality: {
        Min: 0,
        Max: 1
      },
    }
  }

  getSettings(): CameraSettings {
    return {
      gop: v4l2ctl.Controls.CodecControls.h264_i_frame_period.value,
      resolution: this.resolution,
      framerate: this.framerate,
      bitrate: Math.round(v4l2ctl.Controls.CodecControls.video_bitrate.value / 1000),
      quality: v4l2ctl.Controls.CodecControls.video_bitrate_mode.value == 0 ? 1 : 0,
      h264Profile: H264_PROFILES_FROM_VALUE[String(v4l2ctl.Controls.CodecControls.h264_profile.value)] ?? 'Baseline',
    };
  }

  triggerSaveTimeout() {
    if (!this.saveTimeout) {
      // So we don't hammer our flash when people are mutating single settings (e.g. via ONVIF),
      // we save after a delay to bundle a few changes up.
      utils.log.debug('Starting save timeout...');
      this.saveTimeout = setTimeout(() => {
        this.saveTimeout = null;
        this.saveSettings();
      }, SAVE_SETTINGS_DELAY_SECS * 1000);
    }
  }

  saveSettings(sync = false) {
    const settings = {
      v4l2ctl: v4l2ctl.ToJson(),
      resolution: this.resolution,
      framerate: this.framerate,
    };

    utils.log.debug('Saving camera settings to:', this.settingsFilename);
    if (sync) {
      fs.writeFileSync(this.settingsFilename, JSON.stringify(settings, null, 2));
    } else {
      fs.writeFile(this.settingsFilename, JSON.stringify(settings, null, 2), (err) => {
        if (err) {
          utils.log.error(`Error saving settings: ${err}`);
        }
      });
    }
  }

  setSettings(newsettings: CameraSettings) {
    utils.log.debug(JSON.stringify(newsettings));

    const requiresRestart = (
      H264_PROFILES[newsettings.h264Profile] !== v4l2ctl.Controls.CodecControls.h264_profile.value
      || newsettings.resolution.Height !== this.resolution.Height || newsettings.resolution.Width !== this.resolution.Width
      || newsettings.framerate !== this.framerate
    );

    v4l2ctl.Controls.CodecControls.video_bitrate.value = newsettings.bitrate * 1000;
    v4l2ctl.Controls.CodecControls.video_bitrate_mode.value = newsettings.quality > 0 ? 0 : 1;
    v4l2ctl.Controls.CodecControls.h264_i_frame_period.value = newsettings.gop;
    v4l2ctl.Controls.CodecControls.h264_profile.value = H264_PROFILES[newsettings.h264Profile] ?? 4;
    this.resolution.Height = newsettings.resolution.Height;
    this.resolution.Width = newsettings.resolution.Width;
    this.framerate = newsettings.framerate;

    if (v4l2ctl.GetDirtyControls().length === 0 && !requiresRestart) {
      return;
    }

    this.triggerSaveTimeout();
    if (requiresRestart) {
      // Some controls don't apply if we're currently streaming via a different process
      // (some would work if we were the same process, AFAIK), so we have to stop
      // the rtsp server before applying them.
      this.restartRtsp(v4l2ctl.ApplyControls);
    } else {
      v4l2ctl.ApplyControls();
    }
  }

  setBrightness(val: number) {
    v4l2ctl.Controls.UserControls.brightness.value = val;
    if (v4l2ctl.ApplyControls()) {
      this.triggerSaveTimeout();
    }
  }

  getBrightness(): number {
    return v4l2ctl.Controls.UserControls.brightness.value;
  }

  restartRtsp(beforeStartFn: () => void) {
    utils.log.info("Restarting RTSP server");
    // Note that putting it into the 'Restart' state means that when our server dies
    // we know to restart it immediately (see on('exit') below).
    this.rtspServerState = ServerState.Restart;
    this.rtspServerBeforeStartHook = beforeStartFn;
    this.killRtsp();
  }

  startRtsp() {
    if (this.rtspServerBeforeStartHook) {
      this.rtspServerBeforeStartHook();
      this.rtspServerBeforeStartHook = null;
    }

    utils.log.info("Starting rtsp server");

    if (this.config.MulticastEnabled) {
      if (this.config.RTSPServer !== 2) {
        utils.log.warn("Multicast enabled; forcing use of RTSPServer 2 (v4l2rtspserver) instead of %s", this.config.RTSPServer);
        this.config.RTSPServer = 2;
      }
      this.rtspServer = utils.spawn("v4l2rtspserver", ["-P", this.config.RTSPPort.toString(), "-u" , this.config.RTSPName.toString(), "-m", this.config.RTSPMulticastName, "-M", this.config.MulticastAddress.toString() + ":" + this.config.MulticastPort.toString(), "-W",this.resolution.Width.toString(), "-H", this.resolution.Height.toString(), "/dev/video0"]);
    } else {
      if (this.config.RTSPServer == 1) this.rtspServer = utils.spawn("./bin/rtspServer", ["/dev/video0", "2088960", this.config.RTSPPort.toString(), "0", this.config.RTSPName.toString()]);
      if (this.config.RTSPServer == 2) this.rtspServer = utils.spawn("v4l2rtspserver", ["-P",this.config.RTSPPort.toString(), "-u" , this.config.RTSPName.toString(),"-W",this.resolution.Width.toString(),"-H",this.resolution.Height.toString(),"-F",this.framerate.toString(),"/dev/video0"]);
      if (this.config.RTSPServer == 3) this.rtspServer = utils.spawn("./python/gst-rtsp-launch.sh", ["-P",this.config.RTSPPort.toString(), "-u" , this.config.RTSPName.toString(),"-W",this.resolution.Width.toString(),"-H",this.resolution.Height.toString(), "-t", this.config.CameraType, "-d", (this.config.CameraDevice == "" ? "auto" : this.config.CameraDevice)]);
    }

    if (this.rtspServer) {
      this.rtspServerState = ServerState.Running;
      const started = Date.now();

      this.rtspServer.stdout.on('data', data => utils.log.debug("rtspServer: %s", data));
      this.rtspServer.stderr.on('data', data => utils.log.error("rtspServer: %s", data));
      this.rtspServer.on('error', err=> utils.log.error("rtspServer error: %s", err));
      this.rtspServer.on('exit', (code, signal) => {
        if (code)
          utils.log.error("rtspServer exited with code: %s", code);
        else
          utils.log.debug("rtspServer exited")

        if (this.rtspServerState === ServerState.Stopped) {
          return;  // Requested exit (see stopRtsp).
        }

        // Otherwise, we need to restart.

        if (Date.now() - started > 3000 || this.rtspServerState === ServerState.Restart) {
          this.startRtsp();
        } else {
          // We're probably having some startup issue, so should wait a bit.

          // Nasty hack: We might be failing to start because an existing v4l2rtspserver is listening
          // on our port (potentially left over from a crashed RPOS). Let's try to wipe that out.
          if (this.config.RTSPServer == 2) {
            exec(`
              if ! PIDS="$(pgrep v4l2rtspserver)"; then
                sleep 2
                exit 0
              fi
              kill $PIDS
              sleep 2
              if ! PIDS="$(pgrep v4l2rtspserver)"; then
                exit 0
              fi
              kill -s 9 $PIDS
              sleep 1
            `, {}, () => this.startRtsp());
          } else {
            setTimeout(() => {
              this.startRtsp();
            }, 2000);
          }
        }
      });
    }
  }

  stopRtsp() {
    this.rtspServerState = ServerState.Stopped;
    this.killRtsp();
  }

  killRtsp() {
    utils.log.info("Stopping rtsp server")

    let dead = false;
    this.rtspServer.on('exit', () => {
      dead = true;
    });

    this.rtspServer.kill();
    setTimeout(() => {
      if (!dead) {
        utils.log.error("Rtsp server didn't respond to SIGTERM within 2 seconds; sending SIGKILL");
        this.rtspServer.kill('SIGKILL');
      }
    }, 2000);
  }
}

export = Camera;
