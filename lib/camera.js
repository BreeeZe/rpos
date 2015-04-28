var utils = require('./utils');
var fs = require('fs');
var v4l2 = require('./v4l2ctl');
var parser = require('body-parser');

function Camera(config, webserver) {
  this.config = config;
  this.rtspServer = null;
  this.load();
  this.webserver = webserver;
  this.setupWebserver();
  this.setupCamera();
  v4l2.GetControls();
  
  $this = this;
  utils.cleanup(function () {
    $this.stopRtsp();
    var stop = new Date().getTime() + 2000;
    while (new Date().getTime() < stop) {
      //wait for rtsp server to stop
      ;
    }
    utils.execSync("sudo modprobe -r bcm2835-v4l2");
  });
  fs.chmodSync("./bin/rtspServer", "0755");
};

Camera.prototype.setupWebserver = function () {
  var $this = this;
  this.webserver.use(parser.urlencoded({ extended: true }));
  this.webserver.engine('ntl', function (filePath, options, callback) {
    $this.getSettingsPage(filePath, callback);
  });
  this.webserver.set('views', './views'); // specify the views directory
  this.webserver.set('view engine', 'ntl'); // register the template engine
  this.webserver.get('/', function (req, res) {
    res.render('camera', {});
  });
  this.webserver.post('/', function (req, res) {
    for (var par in req.body) {
      var g = par.split('.')[0];
      var p = par.split('.')[1];
      if (p && g) {
        var prop = v4l2.Controls[g][p];
        var val = req.body[par];
        if (val instanceof Array)
          val = val[val.length - 1];
        prop.value = val;
        if (prop.isDirty()) {
          utils.log.debug("Property %s changed to %s", par, prop.get());
        }
      }
    }
    v4l2.SetControls();
    res.render('camera', {});
  });
};

Camera.prototype.getSettingsPage = function (filePath, callback) {
  v4l2.GetControls();
  fs.readFile(filePath, function (err, content) {
    if (err)
      return callback(new Error(err));
    
    var parseControls = function (html, displayname, propname, controls) {
      html += ['<tr><td colspan="2"><strong>', displayname, '</strong></td></tr>'].join('');
      for (var uc in controls) {
        var p = controls[uc];
        if (p.hasSet()) {
          var set = p.getSet();
          html += ['<tr><td><span class="label">', uc, '</span></td><td><select name="', propname, '.', uc, '">'].join('');
          for (var s = 0; s < set.length; s++) {
            var o = set[s];
            html += ['<option value="', o.value, '" ', o.value == p.value ? 'selected="selected "' : '', '>', o.lookup, '</option>'].join('');
          }
          html += '</select></td></tr>';

        } else if (p.type() == "Boolean") {
          html += ['<tr><td><span class="label">', uc, '</span></td><td><input type="hidden" name="', propname, '.', uc, '" value="false" /><input type="checkbox" name="', propname, '.', uc, '" value="true"', p.value ? 'checked="checked"' : '', '" /></td><tr>'].join('');
        } else {
          html += ['<tr><td><span class="label">', uc, '</span></td><td><input type="text" name="', propname, '.', uc, '" value="', p.value, '" /></td><tr>'].join('');
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

Camera.prototype.load = function () {
  utils.execSync("sudo modprobe bcm2835-v4l2");
};

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
  framerate : 25,
  bitrate : 7500,
  profile : "Baseline",
  quality : null,
  exposure : "auto"
};

Camera.prototype.setupCamera = function () {

  utils.execSync(["sudo v4l2-ctl --set-fmt-video=",
        "width=", this.settings.resolution.Width,
        ",height=", this.settings.resolution.Height, 
        ",pixelformat=4"].join(''));

  utils.execSync(["sudo v4l2-ctl --set-parm=", this.settings.framerate].join(''));

}

Camera.prototype.setSettings = function (newsettings) {
  utils.execSync(["sudo v4l2-ctl --set-fmt-video=",
        "width=", newsettings.resolution.Width,
        ",height=", newsettings.resolution.Height, 
        ",pixelformat=4"].join(''));
  
  utils.execSync(["sudo v4l2-ctl --set-ctrl ",
        "video_bitrate=", (newsettings.bitrate * 1000),
        ",video_bitrate_mode=", (newsettings.quality > 0 ? 0 : 1),
        ",h264_i_frame_period=", (this.settings.forceGop ? this.settings.gop : newsettings.gop),
        ",horizontal_flip=", (this.settings.hf ? 1 : 0),
        ",vertical_flip=", (this.settings.vf ? 1 : 0)
  ].join(''));
  
  utils.execSync(["sudo v4l2-ctl --set-parm=", newsettings.frameRate].join(''));
};

Camera.prototype.startRtsp = function (input) {
  if (this.rtspServer) {
    utils.log.warn("Cannot start rtspServer, already running");
    return;
  }
  utils.log.info("Starting Live555 rtsp server");
  
  this.rtspServer = utils.spawn("./bin/rtspServer", [
    input,
    "2088960", 
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