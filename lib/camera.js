var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;
var utils = require('./utils');

function Camera(config) {
  this.config = config;
  this.rtspServer = null;
  this.load();
  $this = this;
  utils.cleanup(function () {
    if (!utils.isWin()) {
      utils.log.debug(execSync("sudo modprobe -r bcm2835-v4l2"));
      $this.stopRtsp();
    }
  });
};

Camera.prototype.load = function () {
  if (!utils.isWin()) {
    utils.log.debug(execSync("sudo modprobe bcm2835-v4l2"));
  } else {
    utils.log.debug("Would load driver");
  }
}

Camera.prototype.options = {
  resolutions : [ 
    { Width : 640, Height : 480 },
    { Width : 800, Height : 600 },
    { Width : 1024, Height : 768 },
    { Width : 1280, Height : 1024 },
    { Width : 1280, Height : 720 },
    { Width : 1920, Height : 1080 }
  ],
  framerates : [2, 5, 10, 15, 25, 30],
  bitrates : [
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
  quality : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  profiles : ["Baseline", "Main", "High"]
};

Camera.prototype.settings = {
  hf : false, //horizontal flip
  vf : true, //vertical flip
  drc : 2, //0=OFF, 1=LOW, 2=MEDIUM, 3=HIGH
  gop : 2, //keyframe every X sec.
  forceGop : true,
  resolution : { Width : 1280, Height: 720 },
  framerate : 30,
  bitrate : 7500,
  profile : "Baseline",
  quality : null,
  exposure : "auto"
};

Camera.prototype.setSettings = function (newsettings) {
  if (!utils.isWin()) {
    
    utils.log.debug(execSync("sudo v4l2-ctl --set-fmt-video=width=" + newsettings.resolution.Width + ",height=" + newsettings.resolution.Height + ",pixelformat=4"));
    utils.log.debug(execSync("sudo v4l2-ctl --set-ctrl " +
    "video_bitrate=" + (newsettings.bitrate * 1000) + 
    ",video_bitrate_mode=" + (newsettings.quality > 0 ? 0 : 1) +
    ",h264_i_frame_period=" + (this.settings.forceGop ? this.settings.gop : newsettings.gop) +
    ",horizontal_flip=" + (this.settings.hf ? 1 : 0) +
    ",vertical_flip=" + (this.settings.vf ? 1 : 0)
    ));
    utils.log.debug(execSync("sudo v4l2-ctl --set-parm=" + newsettings.frameRate));
  } else {
    for (var s in newsettings)
      utils.log.debug("Would set %s to %s", s, newsettings[s]);
  }

//settings.frameRate;
//settings.profile;
//settings.quality;
//settings.resolution;
};

Camera.prototype.startRtsp = function (input) {
  if (this.rtspServer) {
    utils.log.warn("Cannot start rtspServer, already running");
    return;
  }
  utils.log.info("Starting Live555 rtsp server");
  
  this.rtspServer = spawn("./bin/rtspServer", [
    input,
    "1024000", 
    this.config.RTSPPort,
    0,
    this.config.RTSPName]);
  
  this.rtspServer.stdout.on('data', function (data) {
    utils.log.debug("rtspServer: %s", data);
  });
  this.rtspServer.stderr.on('data', function (data) {
    utils.log.error("rtspServer: %s", data);
  });
  this.rtspServer.on('error', function (err) {
    utils.log.error("rtspServer error: %s", err);
  });
  this.rtspServer.on('exit', function (code, signal) {
    if (code)
      utils.log.error("rtspServer exited with code: %s", code);
  });
}

Camera.prototype.stopRtsp = function () {
  if (this.rtspServer) {
    utils.log.info("Stopping Live555 rtsp server");
    this.rtspServer.kill();
    this.rtspServer = null;
  }
}

module.exports = Camera;