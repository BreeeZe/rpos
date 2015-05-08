///<reference path="../typings/rpos/rpos.d.ts"/>
///<reference path="../typings/tsd.d.ts"/>
var utils_1 = require('./utils');
var stringifyBool = function (v) { return v ? "1" : "0"; };
var utils = utils_1.Utils.utils;
var v4l2ctl;
(function (v4l2ctl) {
    (function (Pixelformat) {
        Pixelformat[Pixelformat["YU12"] = 0] = "YU12";
        Pixelformat[Pixelformat["YUYV"] = 1] = "YUYV";
        Pixelformat[Pixelformat["RGB3"] = 2] = "RGB3";
        Pixelformat[Pixelformat["JPEG"] = 3] = "JPEG";
        Pixelformat[Pixelformat["H264"] = 4] = "H264";
        Pixelformat[Pixelformat["MJPG"] = 5] = "MJPG";
        Pixelformat[Pixelformat["YVYU"] = 6] = "YVYU";
        Pixelformat[Pixelformat["VYUY"] = 7] = "VYUY";
        Pixelformat[Pixelformat["UYVY"] = 8] = "UYVY";
        Pixelformat[Pixelformat["NV12"] = 9] = "NV12";
        Pixelformat[Pixelformat["BGR3"] = 10] = "BGR3";
        Pixelformat[Pixelformat["YV12"] = 11] = "YV12";
        Pixelformat[Pixelformat["NV21"] = 12] = "NV21";
        Pixelformat[Pixelformat["BGR4"] = 13] = "BGR4";
    })(v4l2ctl.Pixelformat || (v4l2ctl.Pixelformat = {}));
    var Pixelformat = v4l2ctl.Pixelformat;
    (function (ProcessPriority) {
        ProcessPriority[ProcessPriority["background"] = 1] = "background";
        ProcessPriority[ProcessPriority["interactive"] = 2] = "interactive";
        ProcessPriority[ProcessPriority["record"] = 3] = "record";
    })(v4l2ctl.ProcessPriority || (v4l2ctl.ProcessPriority = {}));
    var ProcessPriority = v4l2ctl.ProcessPriority;
    var UserControl = (function () {
        function UserControl(value, options) {
            if (value === undefined || value === null)
                throw "'value' is required";
            this.typeConstructor = value.constructor;
            this.dirty = false;
            this._value = value === undefined ? null : value;
            this.options = options || {};
            this.options.stringify = this.options.stringify || (function (value) { return value.toString(); });
        }
        Object.defineProperty(UserControl.prototype, "value", {
            get: function () { return this._value; },
            set: function (value) {
                var val = value;
                if (this.typeConstructor.name == "Boolean") {
                    val = (val === true || val === 1 || val + "".toLowerCase() === "true");
                }
                else if (this.typeConstructor.name != "Object")
                    val = this.typeConstructor(val);
                if (val !== null && val !== undefined) {
                    if (this.hasRange && (val < this.options.range.min || val > this.options.range.max) && (val !== 0 || !this.options.range.allowZero))
                        throw ("value: " + val + " not in range: " + this.options.range.min + " - " + this.options.range.max);
                    if (this.hasSet && this.options.lookupSet.map(function (ls) { return ls.value; }).indexOf(val) == -1)
                        throw ("value: " + val + " not in set: " + this.options.lookupSet.map(function (ls) { return ("{ value:" + ls.value + " desc:" + ls.desc + " }"); }).join());
                }
                if (this.hasRange && this.options.range.step && (val) % this.options.range.step !== 0)
                    val = Math.round(val / this.options.range.step) * this.options.range.step;
                if (val !== this._value)
                    this.dirty = true;
                this._value = val;
            },
            enumerable: true,
            configurable: true
        });
        ;
        Object.defineProperty(UserControl.prototype, "type", {
            get: function () {
                return this.typeConstructor.name;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UserControl.prototype, "hasSet", {
            get: function () {
                return (this.options.lookupSet || []).length > 0;
            },
            enumerable: true,
            configurable: true
        });
        ;
        UserControl.prototype.getLookupSet = function () {
            var result = new Array(0);
            for (var _i = 0, _a = this.options.lookupSet; _i < _a.length; _i++) {
                var l = _a[_i];
                result.push({
                    value: l.value,
                    desc: l.desc
                });
            }
            return result;
        };
        ;
        Object.defineProperty(UserControl.prototype, "hasRange", {
            get: function () {
                return !!this.options.range;
            },
            enumerable: true,
            configurable: true
        });
        ;
        UserControl.prototype.getRange = function () {
            if (this.hasRange)
                return { min: this.options.range.min, max: this.options.range.max };
            return null;
        };
        Object.defineProperty(UserControl.prototype, "isDirty", {
            get: function () {
                return this.dirty;
            },
            enumerable: true,
            configurable: true
        });
        ;
        UserControl.prototype.reset = function () {
            this.dirty = false;
        };
        ;
        UserControl.prototype.toString = function () {
            return this.options.stringify(this._value);
        };
        return UserControl;
    })();
    v4l2ctl.UserControl = UserControl;
    v4l2ctl.Controls = {
        UserControls: {
            brightness: new UserControl(50, { range: { min: 0, max: 100 } }),
            contrast: new UserControl(0, { range: { min: -100, max: 100 } }),
            saturation: new UserControl(0, { range: { min: -100, max: 100 } }),
            red_balance: new UserControl(1000, { range: { min: 1, max: 7999 } }),
            blue_balance: new UserControl(1000, { range: { min: 1, max: 7999 } }),
            horizontal_flip: new UserControl(false, { stringify: stringifyBool }),
            vertical_flip: new UserControl(false, { stringify: stringifyBool }),
            power_line_frequency: new UserControl(1, { lookupSet: [{ value: 0, desc: 'Disabled' }, { value: 1, desc: '50 Hz' }, { value: 2, desc: '60 Hz' }, { value: 3, desc: 'Auto' }] }),
            sharpness: new UserControl(0, { range: { min: -100, max: 100 } }),
            color_effects: new UserControl(0, { lookupSet: [{ value: 0, desc: 'None' }, { value: 1, desc: 'Black & White' }, { value: 2, desc: 'Sepia' }, { value: 3, desc: 'Negative' }, { value: 4, desc: 'Emboss' }, { value: 5, desc: 'Sketch' }, { value: 6, desc: 'Sky Blue' }, { value: 7, desc: 'Grass Green' }, { value: 8, desc: 'Skin Whiten' }, { value: 9, desc: 'Vivid' }, { value: 10, desc: 'Aqua' }, { value: 11, desc: 'Art Freeze' }, { value: 12, desc: 'Silhouette' }, { value: 13, desc: 'Solarization' }, { value: 14, desc: 'Antique' }, { value: 15, desc: 'Set Cb/Cr' }] }),
            rotate: new UserControl(0, { range: { min: 0, max: 360 } }),
            color_effects_cbcr: new UserControl(32896, { range: { min: 0, max: 65535 } }),
        },
        CodecControls: {
            video_bitrate_mode: new UserControl(0, { lookupSet: [{ value: 0, desc: 'Variable Bitrate' }, { value: 1, desc: 'Constant Bitrate' }] }),
            video_bitrate: new UserControl(10000000, { range: { min: 25000, max: 25000000, step: 25000, allowZero: true } }),
            repeat_sequence_header: new UserControl(false, { stringify: stringifyBool }),
            h264_i_frame_period: new UserControl(60, { range: { min: 0, max: 2147483647 } }),
            h264_level: new UserControl(11, { lookupSet: [{ value: 0, desc: '1' }, { value: 1, desc: '1b' }, { value: 2, desc: '1.1' }, { value: 3, desc: '1.2' }, { value: 4, desc: '1.3' }, { value: 5, desc: '2' }, { value: 6, desc: '2.1' }, { value: 7, desc: '2.2' }, { value: 8, desc: '3' }, { value: 9, desc: '3.1' }, { value: 10, desc: '3.2' }, { value: 11, desc: '4' }] }),
            h264_profile: new UserControl(4, { lookupSet: [{ value: 0, desc: 'Baseline' }, { value: 1, desc: 'Constrained Baseline' }, { value: 2, desc: 'Main' }, { value: 4, desc: 'High' }] })
        },
        CameraControls: {
            auto_exposure: new UserControl(false, { stringify: stringifyBool }),
            exposure_time_absolute: new UserControl(1000, { range: { min: 0, max: 10000 } }),
            exposure_dynamic_framerate: new UserControl(false, { stringify: stringifyBool }),
            auto_exposure_bias: new UserControl(12, { range: { min: 0, max: 24 } }),
            white_balance_auto_preset: new UserControl(1, { lookupSet: [{ value: 0, desc: 'Manual' }, { value: 1, desc: 'Auto' }, { value: 2, desc: 'Incandescent' }, { value: 3, desc: 'Fluorescent' }, { value: 4, desc: 'Fluorescent' }, { value: 5, desc: 'Horizon' }, { value: 6, desc: 'Daylight' }, { value: 7, desc: 'Flash' }, { value: 8, desc: 'Cloudy' }, { value: 9, desc: 'Shade' }] }),
            image_stabilization: new UserControl(false, { stringify: stringifyBool }),
            iso_sensitivity: new UserControl(0, { lookupSet: [{ value: 0, desc: '0' }, { value: 1, desc: '100' }, { value: 2, desc: '200' }, { value: 3, desc: '400' }, { value: 4, desc: '800' }] }),
            exposure_metering_mode: new UserControl(0, { lookupSet: [{ value: 0, desc: 'Average' }, { value: 1, desc: 'Center Weighted' }, { value: 2, desc: 'Spot' }] }),
            scene_mode: new UserControl(0, { lookupSet: [{ value: 0, desc: 'None' }, { value: 8, desc: 'Night' }, { value: 11, desc: 'Sport' }] })
        },
        JPEGCompressionControls: {
            compression_quality: new UserControl(30, { range: { min: 1, max: 100 } })
        }
    };
    function execV4l2(cmd) {
        return utils.execSync("sudo v4l2-ctl " + cmd).toString();
        ;
    }
    function ApplyControls() {
        var usercontrols = v4l2ctl.Controls.UserControls;
        var codeccontrols = v4l2ctl.Controls.CodecControls;
        var cameracontrols = v4l2ctl.Controls.CameraControls;
        var jpgcontrols = v4l2ctl.Controls.JPEGCompressionControls;
        var getChanges = function (controls) {
            var changes = [];
            for (var c in controls) {
                var control = controls[c];
                if (!control.isDirty)
                    continue;
                changes.push([c, "=", control].join(''));
                control.reset();
            }
            return changes;
        };
        var changedcontrols = getChanges(usercontrols)
            .concat(getChanges(codeccontrols))
            .concat(getChanges(cameracontrols))
            .concat(getChanges(jpgcontrols));
        if (changedcontrols.length > 0)
            execV4l2("--set-ctrl " + changedcontrols.join(','));
    }
    v4l2ctl.ApplyControls = ApplyControls;
    ;
    function ReadControls() {
        var settings = execV4l2("-l");
        var regexPart = ".*value=([0-9]*)";
        var getControls = function (controls) {
            for (var c in controls) {
                var control = controls[c];
                var value = settings.match(new RegExp([c, regexPart].join('')));
                if (!value || (value.length > 1 && value[1] === "" && c == "auto_exposure"))
                    value = settings.match(new RegExp([c.substr(0, c.length - 1), regexPart].join('')));
                if (value && value.length > 1) {
                    utils.log.debug("Controlvalue '%s' : %s", c, value[1]);
                    try {
                        control.value = value[1];
                        control.reset();
                    }
                    catch (ex) {
                        utils.log.error(ex);
                    }
                }
                else {
                    utils.log.error("Could not retrieve Controlvalue '%s'", c);
                }
            }
        };
        var usercontrols = v4l2ctl.Controls.UserControls;
        var codeccontrols = v4l2ctl.Controls.CodecControls;
        var cameracontrols = v4l2ctl.Controls.CameraControls;
        var jpgcontrols = v4l2ctl.Controls.JPEGCompressionControls;
        getControls(usercontrols);
        getControls(codeccontrols);
        getControls(cameracontrols);
        getControls(jpgcontrols);
    }
    v4l2ctl.ReadControls = ReadControls;
    ;
    function SetFrameRate(framerate) {
        execV4l2("--set-parm=" + framerate);
    }
    v4l2ctl.SetFrameRate = SetFrameRate;
    function SetResolution(resolution) {
        execV4l2("--set-fmt-video=width=" + resolution.Width + ",height=" + resolution.Height);
    }
    v4l2ctl.SetResolution = SetResolution;
    function SetPixelFormat(pixelformat) {
        execV4l2("--set-fmt-video=pixelformat=" + pixelformat);
    }
    v4l2ctl.SetPixelFormat = SetPixelFormat;
    function SetPriority(priority) {
        execV4l2("--set-priority=" + priority);
    }
    v4l2ctl.SetPriority = SetPriority;
})(v4l2ctl = exports.v4l2ctl || (exports.v4l2ctl = {}));
//# sourceMappingURL=v4l2ctl.js.map