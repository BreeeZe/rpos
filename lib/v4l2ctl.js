///<reference path="../typings/rpos/rpos.d.ts"/>
///<reference path="../typings/tsd.d.ts"/>
var utils_1 = require('./utils');
var stringifyBool = function (v) { return v ? "1" : "0"; };
var v4l2ctl;
(function (v4l2ctl) {
    var UserControl = (function () {
        function UserControl(value, options) {
            this.typeConstructor = value.constructor;
            this.dirty = false;
            this._value = value === undefined ? null : value;
            this.options = options || {};
            this.options.stringify = this.options.stringify || (function (value) { return value.toString(); });
        }
        Object.defineProperty(UserControl.prototype, "value", {
            get: function () { return this._value; },
            set: function (value) {
                if (this.typeConstructor) {
                    if (this.typeConstructor.name == "Boolean") {
                        value = (value.toUpperCase() === "TRUE" ? true : value.toUpperCase() === "FALSE" ? false : value == 1);
                    }
                    else if (this.typeConstructor.name != "Object")
                        value = this.typeConstructor(value);
                }
                else {
                    this.typeConstructor = value.constructor;
                }
                if (value !== null && value !== undefined) {
                    if (this.hasRange && (value < this.options.range.min || value > this.options.range.max))
                        throw (["value ", value, " not in range ", this.options.range.min, " - ", this.options.range.max].join(''));
                    if (this.hasSet && this.options.set.indexOf(value) == -1)
                        throw (["value ", value, " not in set ", this.options.set.join()].join(''));
                }
                if (value !== this._value)
                    this.dirty = true;
                this._value = value;
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
                return (this.options.set || []).length > 0;
            },
            enumerable: true,
            configurable: true
        });
        ;
        UserControl.prototype.getLookupSet = function () {
            var result = new Array(0);
            if (this.hasSet) {
                for (var i = 0; i < this.options.set.length; i++) {
                    result.push({ value: this.options.set[i], lookup: this.options.lookup[i] });
                }
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
            vertical_flip: new UserControl(true, { stringify: stringifyBool }),
            power_line_frequency: new UserControl(1, { set: [0, 1, 2, 3], lookup: ['Disabled', '50 Hz', '60 Hz', 'Auto'] }),
            sharpness: new UserControl(0, { range: { min: -100, max: 100 } }),
            color_effects: new UserControl(0, { set: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], lookup: ['None', 'Black & White', 'Sepia', 'Negative', 'Emboss', 'Sketch', 'Sky Blue', 'Grass Green', 'Skin Whiten', 'Vivid', 'Aqua', 'Art Freeze', 'Silhouette', 'Solarization', 'Antique', 'Set Cb/Cr'] }),
            rotate: new UserControl(0, { range: { min: 0, max: 360 } }),
            color_effects_cbcr: new UserControl(32896, { range: { min: 0, max: 65535 } }),
        },
        CodecControls: {
            video_bitrate_mode: new UserControl(0, { set: [0, 1], lookup: ['Variable Bitrate', 'Constant Bitrate'] }),
            video_bitrate: new UserControl(10000000, { range: { min: 25000, max: 25000000, step: 25000 } }),
            repeat_sequence_header: new UserControl(false, { stringify: stringifyBool }),
            h264_i_frame_period: new UserControl(60, { range: { min: 0, max: 2147483647 } }),
            h264_level: new UserControl(11, { set: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], lookup: ['1', '1b', '1.1', '1.2', '1.3', '2', '2.1', '2.2', '3', '3.1', '3.2', '4'] }),
            h264_profile: new UserControl(4, { set: [0, 1, 2, 4], lookup: ['Baseline', 'Constrained Baseline', 'Main', 'High'] })
        },
        CameraControls: {
            auto_exposure: new UserControl(false, { stringify: stringifyBool }),
            exposure_time_absolute: new UserControl(1000, { range: { min: 0, max: 10000 } }),
            exposure_dynamic_framerate: new UserControl(false, { stringify: stringifyBool }),
            auto_exposure_bias: new UserControl(12, { range: { min: 0, max: 24 } }),
            white_balance_auto_preset: new UserControl(1, { set: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], lookup: ['Manual', 'Auto', 'Incandescent', 'Fluorescent', 'Fluorescent', 'Horizon', 'Daylight', 'Flash', 'Cloudy', 'Shade'] }),
            image_stabilization: new UserControl(false, { stringify: stringifyBool }),
            iso_sensitivity: new UserControl(0, { set: [0, 1, 2, 3, 4], lookup: ['0', '100', '200', '400', '800'] }),
            exposure_metering_mode: new UserControl(0, { set: [0, 1, 2], lookup: ['Average', 'Center Weighted', 'Spot'] }),
            scene_mode: new UserControl(0, { set: [0, 8, 11], lookup: ['None', 'Night', 'Sports'] })
        },
        JPEGCompressionControls: {
            compression_quality: new UserControl(30, { range: { min: 1, max: 100 } })
        }
    };
    function SetControls() {
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
            utils_1.utils.execSync(["sudo v4l2-ctl --set-ctrl ", changedcontrols.join(',')].join(''));
    }
    v4l2ctl.SetControls = SetControls;
    ;
    function GetControls() {
        var settings = utils_1.utils.execSync("v4l2-ctl -l").toString();
        var regexPart = ".*value=([0-9]*)";
        var getControls = function (controls) {
            for (var c in controls) {
                var control = controls[c];
                var value = settings.match(new RegExp([c, regexPart].join('')));
                if (!value || (value.length > 1 && value[1] === "" && c == "auto_exposure"))
                    value = settings.match(new RegExp([c.substr(0, c.length - 1), regexPart].join('')));
                if (value && value.length > 1) {
                    utils_1.utils.log.debug("Controlvalue '%s' : %s", c, value[1]);
                    try {
                        control.value = value[1];
                        control.reset();
                    }
                    catch (ex) {
                        utils_1.utils.log.error(ex);
                    }
                }
                else {
                    utils_1.utils.log.error("Could not retrieve Controlvalue '%s'", c);
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
    v4l2ctl.GetControls = GetControls;
    ;
})(v4l2ctl || (v4l2ctl = {}));
module.exports = v4l2ctl;
//# sourceMappingURL=v4l2ctl.js.map