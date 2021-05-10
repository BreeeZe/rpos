///<reference path="../rpos.d.ts"/>

import { Utils } from './utils';
import { writeFileSync, readFileSync } from 'fs';
var stringifyBool = (v: boolean) => { return v ? "1" : "0"; }
var utils = Utils.utils;

export module v4l2ctl {
    export enum Pixelformat {
        YU12 = 0, // 4:2:0, packed YUV
        YUYV = 1, // 4:2:2, packed, YUYV
        RGB3 = 2, // RGB24 (LE)
        JPEG = 3, // JPEG
        H264 = 4, // H264
        MJPG = 5, // MJPEG
        YVYU = 6, // 4:2:2, packed, YVYU
        VYUY = 7, // 4:2:2, packed, VYUY
        UYVY = 8, // 4:2:2, packed, UYVY
        NV12 = 9, // 4:2:0, packed, NV12
        BGR3 = 10,// RGB24 (BE)
        YV12 = 11,// 4:2:0, packed YVU
        NV21 = 12,// 4:2:0, packed, NV21
        BGR4 = 13,// RGB32 (BE)
    }

    export enum ProcessPriority {
        background = 1,
        interactive = 2,
        record = 3
    }

    export class UserControl<T extends Object> {
        private typeConstructor: TypeConstructor;
        private dirty: boolean;
        private _value: T;
        private options: UserControlOptions<T>;

        constructor(value: T, options: UserControlOptions<T>) {
            if (value === undefined || value === null)
                throw "'value' is required";

            this.typeConstructor = <TypeConstructor>value.constructor;
            this.dirty = false;
            this._value = value === undefined ? null : value;
            this.options = options || {};
            this.options.stringify = this.options.stringify || (value => value.toString());
        }

        get value(): T { return this._value; };

        set value(value: T) {
            var val: any = value;
            if (this.typeConstructor.name == "Boolean") {
                val = (val === true || val === 1 || (<string>val) + "".toLowerCase() === "true" || val === "1");
            } else if (this.typeConstructor.name != "Object")
                val = this.typeConstructor(val);

            if (val !== null && val !== undefined) {
                if (this.hasRange && (val < this.options.range.min || val > this.options.range.max) && (<number>val !== 0 || !this.options.range.allowZero))
                    throw (`value: ${val} not in range: ${this.options.range.min} - ${this.options.range.max}`);
                if (this.hasSet && this.options.lookupSet.map(ls=> ls.value).indexOf(val) == -1)
                    throw (`value: ${val} not in set: ${this.options.lookupSet.map(ls=> `{ value:${ls.value} desc:${ls.desc} }`).join() }`);
            }

            if (this.hasRange && this.options.range.step && <number>(val) % <number>(<any>this.options.range.step) !== 0)
                val = Math.round(<number>val / <number>(<any>this.options.range.step)) * <number>(<any>this.options.range.step);

            if (val !== this._value)
                this.dirty = true;

            this._value = val;
        }
        
        get desc():string{
            if (this.hasSet)
                // search the lookup set for this.value and return desc
                for (var l of this.options.lookupSet) {
                    if (l.value === this.value) return l.desc;
                }
            throw "'lookup value' not in lookup set";
        }

        get type(): string {
            return this.typeConstructor.name;
        }

        get hasSet(): boolean {
            return (this.options.lookupSet || []).length > 0;
        };

        getLookupSet(): UserControlsLookupSet<T> {
            var result = new Array<UserControlsLookup<T>>(0);
            for (var l of this.options.lookupSet) {
                result.push({
                    value: l.value,
                    desc: l.desc
                })
            }
            return result;
        };
        get hasRange(): boolean {
            return !!this.options.range;
        };

        getRange() {
            if (this.hasRange)
                return { min: this.options.range.min, max: this.options.range.max };

            return null;
        }

        get isDirty(): boolean {
            return this.dirty;
        };

        reset() {
            this.dirty = false;
        };

        toString(): string {
            return this.options.stringify(this._value);
        }
    }

    export var Controls = {
        UserControls: {
            // min=0 max=100 step=1 default=50 value=50 flags=slider
            brightness: new UserControl(50, { range: { min: 0, max: 100 } }),
      
            // min=-100 max=100 step=1 default=0 value=0 flags=slider
            contrast: new UserControl(0, { range: { min: -100, max: 100 } }),
      
            // min=-100 max=100 step=1 default=0 value=0 flags=slider                     
            saturation: new UserControl(0, { range: { min: -100, max: 100 } }),
      
            // min=1 max=7999 step=1 default=1000 value=1000 flags=slider                     
            red_balance: new UserControl(1000, { range: { min: 1, max: 7999 } }),
      
            // min=1 max=7999 step=1 default=1000 value=1000 flags=slider
            blue_balance: new UserControl(1000, { range: { min: 1, max: 7999 } }),
      
            // default=0 value=0     
            horizontal_flip: new UserControl(false, { stringify: stringifyBool }),
      
            // default=0 value=0             
            vertical_flip: new UserControl(false, { stringify: stringifyBool }),
      
            // min=0 max=3 default=1 value=1 | 0: Disabled,1: 50 Hz,2: 60 Hz,3: Auto           
            power_line_frequency: new UserControl(1, { lookupSet: [{ value: 0, desc: 'Disabled' }, { value: 1, desc: '50 Hz' }, { value: 2, desc: '60 Hz' }, { value: 3, desc: 'Auto' }] }),
      
            // min=-100 max=100 step=1 default=0 value=0 flags=slider
            sharpness: new UserControl(0, { range: { min: -100, max: 100 } }),
      
            // min=0 max=15 default=0 value=0 | 0: None,1: Black & White,2: Sepia,3: Negative,4: Emboss,5: Sketch,6: Sky Blue,7: Grass Green,8: Skin Whiten,9: Vivid,10: Aqua,11: Art Freeze,12: Silhouette,13: Solarization,14: Antique,15: Set Cb/Cr
            color_effects: new UserControl(0, { lookupSet: [{ value: 0, desc: 'None' }, { value: 1, desc: 'Black & White' }, { value: 2, desc: 'Sepia' }, { value: 3, desc: 'Negative' }, { value: 4, desc: 'Emboss' }, { value: 5, desc: 'Sketch' }, { value: 6, desc: 'Sky Blue' }, { value: 7, desc: 'Grass Green' }, { value: 8, desc: 'Skin Whiten' }, { value: 9, desc: 'Vivid' }, { value: 10, desc: 'Aqua' }, { value: 11, desc: 'Art Freeze' }, { value: 12, desc: 'Silhouette' }, { value: 13, desc: 'Solarization' }, { value: 14, desc: 'Antique' }, { value: 15, desc: 'Set Cb/Cr' }] }),
            // min=0 max=360 step=90 default=0 value=0
            rotate: new UserControl(0, { range: { min: 0, max: 360 } }),
            // min=0 max=65535 step=1 default=32896 value=32896
            color_effects_cbcr: new UserControl(32896, { range: { min: 0, max: 65535 } }),
        },
        CodecControls: {
            // min=0 max=1 default=0 value=0 flags=update | 0: Variable Bitrate,1: Constant Bitrate
            video_bitrate_mode: new UserControl(0, { lookupSet: [{ value: 0, desc: 'Variable Bitrate' }, { value: 1, desc: 'Constant Bitrate' }] }),
            // min=25000 max=25000000 step=25000 default=10000000 value=10000000
            video_bitrate: new UserControl(10000000, { range: { min: 25000, max: 25000000, step: 25000, allowZero: true } }),
            // default=0 value=0
            repeat_sequence_header: new UserControl(false, { stringify: stringifyBool }),
            // min=0 max=2147483647 step=1 default=60 value=60
            h264_i_frame_period: new UserControl(60, { range: { min: 0, max: 2147483647 } }),
            // min=0 max=11 default=11 value=11 | 0:1,1:1b,2:1.1,3:1.2,4:1.3,5:2,6:2.1,7:2.2,8:3,9:3.1,10:3.2,11:4
            h264_level: new UserControl(11, { lookupSet: [{ value: 0, desc: '1' }, { value: 1, desc: '1b' }, { value: 2, desc: '1.1' }, { value: 3, desc: '1.2' }, { value: 4, desc: '1.3' }, { value: 5, desc: '2' }, { value: 6, desc: '2.1' }, { value: 7, desc: '2.2' }, { value: 8, desc: '3' }, { value: 9, desc: '3.1' }, { value: 10, desc: '3.2' }, { value: 11, desc: '4' }] }),
            // min=0 max=4 default=4 value=4 | 0:Baseline,1:Constrained Baseline,2:Main,4:High
            h264_profile: new UserControl(4, { lookupSet: [{ value: 0, desc: 'Baseline' }, { value: 1, desc: 'Constrained Baseline' }, { value: 2, desc: 'Main' }, { value: 4, desc: 'High' }] })
        },
        CameraControls: {
            // min=0 max=3 default=0 value=0
            auto_exposure: new UserControl(false, { stringify: stringifyBool }),
            // min=1 max=10000 step=1 default=1000 value=1000
            exposure_time_absolute: new UserControl(1000, { range: { min: 0, max: 10000 } }),
            // default=0 value=0
            exposure_dynamic_framerate: new UserControl(false, { stringify: stringifyBool }),
            // min=0 max=24 default=12 value=12
            auto_exposure_bias: new UserControl(12, { range: { min: 0, max: 24 } }),
            // min=0 max=9 default=1 value=1 | 0:Manual,1:Auto,2:Incandescent,3:Fluorescent,4:Fluorescent,5:Horizon,6:Daylight,7:Flash,8:Cloudy,9:Shade
            white_balance_auto_preset: new UserControl(1, { lookupSet: [{ value: 0, desc: 'Manual' }, { value: 1, desc: 'Auto' }, { value: 2, desc: 'Incandescent' }, { value: 3, desc: 'Fluorescent' }, { value: 4, desc: 'Fluorescent' }, { value: 5, desc: 'Horizon' }, { value: 6, desc: 'Daylight' }, { value: 7, desc: 'Flash' }, { value: 8, desc: 'Cloudy' }, { value: 9, desc: 'Shade' }] }),
            // default=0 value=0
            image_stabilization: new UserControl(false, { stringify: stringifyBool }),
            // min=0 max=4 default=0 value=0 | 0: 0,1: 100,2: 200,3: 400,4: 800,
            iso_sensitivity: new UserControl(0, { lookupSet: [{ value: 0, desc: '0' }, { value: 1, desc: '100' }, { value: 2, desc: '200' }, { value: 3, desc: '400' }, { value: 4, desc: '800' }] }),
            // min=0 max=2 default=0 value=0 | 0: Average,1: Center Weighted,2: Spot,
            exposure_metering_mode: new UserControl(0, { lookupSet: [{ value: 0, desc: 'Average' }, { value: 1, desc: 'Center Weighted' }, { value: 2, desc: 'Spot' }] }),
            // min=0 max=13 default=0 value=0 | 0: None,8: Night,11: Sports
            scene_mode: new UserControl(0, { lookupSet: [{ value: 0, desc: 'None' }, { value: 8, desc: 'Night' }, { value: 11, desc: 'Sport' }] })
        },
        JPEGCompressionControls: {
            // min=1 max=100 step=1 default=30 value=30
            compression_quality: new UserControl(30, { range: { min: 1, max: 100 } })
        }
    };

    function execV4l2(cmd: string): string {
        try {
            return utils.execSync(`v4l2-ctl ${cmd}`).toString();
        } catch (err) {
            return '';
        }
    }

    export function ApplyControls() {
        var usercontrols = Controls.UserControls;
        var codeccontrols = Controls.CodecControls;
        var cameracontrols = Controls.CameraControls;
        var jpgcontrols = Controls.JPEGCompressionControls;

        var getChanges = function(controls: {}) {
            var changes = [];
            for (var c in controls) {
                var control = <UserControl<any>>controls[c];
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

        if (changedcontrols.length > 0) {
            execV4l2(`--set-ctrl ${changedcontrols.join(',') }`);
            WriteToFile();
        }
    }

    export function WriteToFile() {
        var data = {};
        for (var ct in Controls) {
            data[ct] = {};
            for (var k in Controls[ct]) {
                var uc = <UserControl<any>>Controls[ct][k];
                data[ct][k] = uc.value;
            }
        }
        var json = JSON.stringify(data);
        json = json.replace(/{"/g,"{\n\"").replace(/:{/g, ":\n{").replace(/,"/g, ",\n\"").replace(/}/g,"}\n");
        writeFileSync("v4l2ctl.json", json);
    }

    export function ReadFromFile() {
        try {
            var data = JSON.parse(readFileSync("v4l2ctl.json").toString());
            for (var ct in data) {
                for (var k in data[ct]) {
                    var uc = <UserControl<any>>Controls[ct][k];
                    uc.value = data[ct][k];
                }
            }
        } catch (ex) {
            utils.log.error("v4l2ctl.json does not exist yet or invalid.")
        }
    }

    export function ReadControls() {
        var settings = execV4l2("-l");
        var regexPart = "\\s.*value=([0-9]*)";

        var getControls = function(controls) {
            for (var c in controls) {
                var control = controls[c];
                var value = settings.match(new RegExp([c, regexPart].join('')));
                if (!value || (value.length > 1 && value[1] === "" && c == "auto_exposure")) //-- fix for typo in camera driver!
                    value = settings.match(new RegExp([c.substr(0, c.length - 1), regexPart].join('')));
                if (value && value.length > 1) {
                    utils.log.debug("Controlvalue '%s' : %s", c, value[1]);
                    try {
                        control.value = value[1];
                        control.reset();
                    } catch (ex) {
                        utils.log.error(ex);
                    }
                } else {
                    utils.log.error("Could not retrieve Controlvalue '%s'", c);
                }
            }
        };

        var usercontrols = Controls.UserControls;
        var codeccontrols = Controls.CodecControls;
        var cameracontrols = Controls.CameraControls;
        var jpgcontrols = Controls.JPEGCompressionControls;
        getControls(usercontrols);
        getControls(codeccontrols);
        getControls(cameracontrols);
        getControls(jpgcontrols);

        WriteToFile();
    }

    export function SetFrameRate(framerate: number) {
        execV4l2(`--set-parm=${framerate}`);
    }

    export function SetResolution(resolution: Resolution) {
        execV4l2(`--set-fmt-video=width=${resolution.Width},height=${resolution.Height}`);
    }

    export function SetPixelFormat(pixelformat: Pixelformat) {
        execV4l2(`--set-fmt-video=pixelformat=${pixelformat}`);
    }

    export function SetPriority(priority: ProcessPriority) {
        execV4l2(`--set-priority=${priority}`);
    }

    export function SetBrightness(brightness: number) {
        execV4l2(`--set-ctrl brightness=${brightness}`);
    }
}
