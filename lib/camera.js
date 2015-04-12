var spawn = require('child_process').spawn;
var utils = require('./utils');

function Camera(config) {
  this.config = config;
  this.raspivid = null;
  this.gst = null;
  this.rtspServer = null;
};

Camera.prototype.options = {
  resolutions : [ 
    { Width : 640, Height : 480, Framerates : [2, 5, 10, 15, 25, 30, 60, 90] },
    { Width : 800, Height : 600, Framerates : [2, 5, 10, 15, 25, 30, 60] },
    { Width : 1024, Height : 768, Framerates : [2, 5, 10, 15, 25, 30, 60] },
    { Width : 1280, Height : 1024, Framerates : [2, 5, 10, 15, 25, 30] },
    { Width : 1280, Height : 720, Framerates : [2, 5, 10, 15, 25, 30, 60] },
    { Width : 1920, Height : 1080, Framerates : [2, 5, 10, 15, 25, 30] }
  ],
  
  bitrates : [
    250000, 
    500000, 
    1000000, 
    2500000, 
    5000000, 
    7500000, 
    10000000, 
    12500000, 
    15000000, 
    17500000
  ],
  
  quality : [1, 2, 3, 4, 5]
};

Camera.prototype.settings = {
  hf : false, //horizontal flip
  vf : true, //vertical flip
  drc : 3, //0=OFF, 1=LOW, 2=MEDIUM, 3=HIGH
  gop : 2, //keyframe every X sec.
  resolution : { Width : 1280, Height: 720 },
  framerate : 30,
  bitrate : 7500000
};

Camera.prototype.startAll = function () {
  this.startVideo(false);
  this.startRtsp();
  this.startGst();
};

Camera.prototype.startVideo = function (pipe) {
  this.stopVideo();
  
  utils.log.info("Starting video");
  this.raspivid = spawn("raspivid", [
    "-o", "-", 
    "-t", "0",
    "-vf",
    "-ex", "auto",
    "-fps", this.settings.framerate, 
    "-b", this.settings.bitrate,
    "-w", this.settings.resolution.Width, 
    "-h", this.settings.resolution.Height, 
    "-g", this.settings.gop]);
  
  this.raspivid.stderr.on('data', function (data) {
    utils.log.error("raspivid: %s", data);
  });
  if (pipe) {
    this._pipeVideoToGStreamer();
    this._pipeVideoToRtsp();
  }
}

Camera.prototype.stopVideo = function () {
  if (this.raspivid) {
    utils.log.info("Stopping video");
    this.raspivid.stdout.unpipe();
    this.raspivid.kill();
  }
}

Camera.prototype.startRtsp = function () {
  this.stopRtsp();
  utils.log.info("Starting Live555 rtsp server");
  
  this.rtspServer = spawn("./bin/rtspServer", [
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
  this._pipeVideoToRtsp();
}

Camera.prototype.stopRtsp = function () {
  if (this.rtspServer) {
    utils.log.info("Stopping Live555 rtsp server");
    this.rtspServer.kill();
  }
}

Camera.prototype.startGst = function () {
  this.stopGst();
  utils.log.info("Starting GStreamer");
  
  this.gst = spawn("gst-launch-1.0", 
    ["fdsrc", "fd=0", 
      "!", "video/x-h264,framerate=" + this.settings.framerate + "/1,stream-format=byte-stream", 
      "!", "decodebin", 
      "!", "videorate", 
      "!", "video/x-raw,framerate=1/1", 
      "!", "videoconvert", 
      "!", "jpegenc", 
      "!", "multifilesink", "location=/dev/shm/snapshot.jpg"]);
  
  this.gst.stdout.on('data', function (data) {
    utils.log.debug("gst: %s", data);
  });
  this.gst.stderr.on('data', function (data) {
    utils.log.error("gst: %s", data);
  });
  this._pipeVideoToGStreamer();
}

Camera.prototype.stopGst = function () {
  if (this.gst) {
    utils.log.info("Stopping GStreamer");
    this.gst.kill();
  }
}

Camera.prototype._pipeVideoToRtsp = function () {
  if (this.raspivid && this.rtspServer) {
    this.raspivid.stdout.unpipe(this.rtspServer.stdin);
    utils.log.debug("Piping video to rtsp");
    this.raspivid.stdout.pipe(this.rtspServer.stdin, { end: false });
  }
}

Camera.prototype._pipeVideoToGStreamer = function () {
  if (this.raspivid && this.rtspServer) {
    this.raspivid.stdout.unpipe(this.gst.stdin);
    utils.log.debug("Piping video to GStreamer");
    this.raspivid.stdout.pipe(this.gst.stdin, { end: false });
  }
}

module.exports = Camera;