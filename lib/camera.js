///<reference path="../typings/tsd.d.ts"/>
///<reference path="../typings/rpos/rpos.d.ts"/>
var utils_1 = require('./utils');
var fs = require('fs');
var parser = require('body-parser');
var v4l2 = require('./v4l2ctl');
var Camera = (function () {
    function Camera(config, webserver) {
        var _this = this;
        this.options = {
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
        this.settings = {
            hf: false,
            vf: true,
            drc: 2,
            gop: 2,
            forceGop: true,
            resolution: { Width: 1280, Height: 720 },
            framerate: 25,
            bitrate: 7500,
            profile: "Baseline",
            quality: null,
            exposure: "auto"
        };
        this.config = config;
        this.rtspServer = null;
        this.load();
        this.webserver = webserver;
        this.setupWebserver();
        this.setupCamera();
        v4l2.GetControls();
        utils_1.utils.cleanup(function () {
            _this.stopRtsp();
            var stop = new Date().getTime() + 2000;
            while (new Date().getTime() < stop) {
                ;
            }
            utils_1.utils.execSync("sudo modprobe -r bcm2835-v4l2");
        });
        fs.chmodSync("./bin/rtspServer", "0755");
    }
    Camera.prototype.setupWebserver = function () {
        var _this = this;
        this.webserver.use(parser.urlencoded({ extended: true }));
        this.webserver.engine('ntl', function (filePath, options, callback) {
            _this.getSettingsPage(filePath, callback);
        });
        this.webserver.set('views', './views');
        this.webserver.set('view engine', 'ntl');
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
                        val = val.pop();
                    prop.value = val;
                    if (prop.isDirty) {
                        utils_1.utils.log.debug("Property %s changed to %s", par, prop.value);
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
                return callback(new Error(err.message));
            var parseControls = function (html, displayname, propname, controls) {
                html += "<tr><td colspan=\"2\"><strong>" + displayname + "</strong></td></tr>";
                for (var uc in controls) {
                    var p = controls[uc];
                    if (p.hasSet) {
                        var set = p.getLookupSet();
                        html += "<tr><td><span class=\"label\">" + uc + "</span></td><td><select name=\"" + propname + "." + uc + "\">";
                        for (var _i = 0; _i < set.length; _i++) {
                            var o = set[_i];
                            html += "<option value=\"" + o.value + "\" " + (o.value == p.value ? 'selected="selected"' : '') + ">" + o.lookup + "</option>";
                        }
                        html += '</select></td></tr>';
                    }
                    else if (p.type == "Boolean") {
                        html += "<tr><td><span class=\"label\">" + uc + "</span></td>\n              <td><input type=\"hidden\" name=\"" + propname + "." + uc + "\" value=\"false\" />\n              <input type=\"checkbox\" name=\"" + propname + "." + uc + "\" value=\"true\" " + (p.value ? 'checked="checked"' : '') + "/></td><tr>";
                    }
                    else {
                        html += "<tr><td><span class=\"label\">" + uc + "</span></td>\n              <td><input type=\"text\" name=\"" + propname + "." + uc + "\" value=\"" + p.value + "\" /></td><tr>";
                    }
                }
                return html;
            };
            var html = parseControls("", 'User Controls', 'UserControls', v4l2.Controls.UserControls);
            html = parseControls(html, 'Codec Controls', 'CodecControls', v4l2.Controls.CodecControls);
            html = parseControls(html, 'Camera Controls', 'CameraControls', v4l2.Controls.CameraControls);
            html = parseControls(html, 'JPG Compression Controls', 'JPEGCompressionControls', v4l2.Controls.JPEGCompressionControls);
            var rendered = content.toString().replace('{{row}}', html);
            return callback(null, rendered);
        });
    };
    Camera.prototype.load = function () {
        utils_1.utils.execSync("sudo modprobe bcm2835-v4l2");
    };
    Camera.prototype.setupCamera = function () {
        utils_1.utils.execSync("sudo v4l2-ctl --set-fmt-video=width=" + this.settings.resolution.Width + ",height=" + this.settings.resolution.Height + ",pixelformat=4");
        utils_1.utils.execSync("sudo v4l2-ctl --set-parm=" + this.settings.framerate);
    };
    Camera.prototype.setSettings = function (newsettings) {
        utils_1.utils.execSync("sudo v4l2-ctl --set-fmt-video=width=" + newsettings.resolution.Width + ",height=" + newsettings.resolution.Height + ",pixelformat=4");
        utils_1.utils.execSync("sudo v4l2-ctl --set-ctrl " +
            ("video_bitrate=" + (newsettings.bitrate * 1000)) +
            (",video_bitrate_mode=" + (newsettings.quality > 0 ? 0 : 1)) +
            (",h264_i_frame_period=" + (this.settings.forceGop ? this.settings.gop : newsettings.gop)) +
            (",horizontal_flip=" + (this.settings.hf ? 1 : 0)) +
            (",vertical_flip=" + (this.settings.vf ? 1 : 0)));
        utils_1.utils.execSync("sudo v4l2-ctl --set-parm=" + newsettings.frameRate);
    };
    Camera.prototype.startRtsp = function (input) {
        if (this.rtspServer) {
            utils_1.utils.log.warn("Cannot start rtspServer, already running");
            return;
        }
        utils_1.utils.log.info("Starting Live555 rtsp server");
        this.rtspServer = utils_1.utils.spawn("./bin/rtspServer", [input, "2088960", this.config.RTSPPort, 0, this.config.RTSPName]);
        this.rtspServer.stdout.on('data', function (data) { return utils_1.utils.log.debug("rtspServer: %s", data); });
        this.rtspServer.stderr.on('data', function (data) { return utils_1.utils.log.error("rtspServer: %s", data); });
        this.rtspServer.on('error', function (err) { return utils_1.utils.log.error("rtspServer error: %s", err); });
        this.rtspServer.on('exit', function (code, signal) {
            if (code)
                utils_1.utils.log.error("rtspServer exited with code: %s", code);
            else
                utils_1.utils.log.debug("rtspServer exited");
        });
    };
    Camera.prototype.stopRtsp = function () {
        if (this.rtspServer) {
            utils_1.utils.log.info("Stopping Live555 rtsp server");
            this.rtspServer.kill();
            this.rtspServer = null;
        }
    };
    return Camera;
})();
module.exports = Camera;
//# sourceMappingURL=camera.js.map