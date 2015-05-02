///<reference path="../typings/rpos/rpos.d.ts"/>
///<reference path="../typings/tsd.d.ts"/>
import { utils, logLevel} from './utils';
var stringifyBool = (v: boolean) => { return v ? "1" : "0"; }

module v4l2ctl {
  export class UserControl<T extends Object> {
    typeConstructor: TypeConstructor;
    dirty: boolean;
    _value: T;
    options: {
      stringify: (T) => string,
      range?: {
        min: number,
        max: number
      }
      set?: T[],
      lookup?: string[]
    };

    constructor(value: T, options) {
      this.typeConstructor = <TypeConstructor>value.constructor;
      this.dirty = false;
      this._value = value === undefined ? null : value;
      this.options = options || {};
      this.options.stringify = this.options.stringify || (value => value.toString());
    }


    get value(): T { return this._value; };

    set value(value: T) {
      if (this.typeConstructor) {
        if (this.typeConstructor.name == "Boolean") {
          value = <T>(<any>((<any>value).toUpperCase() === "TRUE" ? true : (<any>value).toUpperCase() === "FALSE" ? false : <any>value == 1));
        } else if (this.typeConstructor.name != "Object")
          value = this.typeConstructor(value);
      } else {
        this.typeConstructor = <TypeConstructor>value.constructor;
      }
      if (value !== null && value !== undefined) {
        if (this.hasRange && (<any>value < this.options.range.min || <any>value > this.options.range.max))
          throw (["value ", value, " not in range ", this.options.range.min, " - ", this.options.range.max].join(''));
        if (this.hasSet && this.options.set.indexOf(value) == -1)
          throw (["value ", value, " not in set ", this.options.set.join()].join(''));
      }

      if (value !== this._value)
        this.dirty = true;

      this._value = value;
    }
    get type(): string {
      return this.typeConstructor.name;
    }

    get hasSet(): boolean {
      return (this.options.set || []).length > 0;
    };

    getLookupSet() {
      var result: [{ value: T, lookup: string }] = <[{ value: T, lookup: string }]>new Array(0);
      if (this.hasSet) {
        for (var i = 0; i < this.options.set.length; i++) {
          result.push({ value: this.options.set[i], lookup: this.options.lookup[i] });
        }
      }
      return result;
    };
    get hasRange(): boolean {
      return !!this.options.range;
    };

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
      brightness: new UserControl(50, { range: { min: 0, max: 100 } }),                     // min=0 max=100 step=1 default=50 value=50 flags=slider
      contrast: new UserControl(0, { range: { min: -100, max: 100 } }),                        // min=-100 max=100 step=1 default=0 value=0 flags=slider
      saturation: new UserControl(0, { range: { min: -100, max: 100 } }),                      // min=-100 max=100 step=1 default=0 value=0 flags=slider
      red_balance: new UserControl(1000, { range: { min: 1, max: 7999 } }),                  // min=1 max=7999 step=1 default=1000 value=1000 flags=slider
      blue_balance: new UserControl(1000, { range: { min: 1, max: 7999 } }),                 // min=1 max=7999 step=1 default=1000 value=1000 flags=slider
      horizontal_flip: new UserControl(false, { stringify: stringifyBool }),             // default=0 value=0
      vertical_flip: new UserControl(true, { stringify: stringifyBool }),               // default=0 value=0
      power_line_frequency: new UserControl(1, { set: [0, 1, 2, 3], lookup: ['Disabled', '50 Hz', '60 Hz', 'Auto'] }),            // min=0 max=3 default=1 value=1 | 0: Disabled,1: 50 Hz,2: 60 Hz,3: Auto
      sharpness: new UserControl(0, { range: { min: -100, max: 100 } }),                       // min=-100 max=100 step=1 default=0 value=0 flags=slider
      color_effects: new UserControl(0, { set: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], lookup: ['None', 'Black & White', 'Sepia', 'Negative', 'Emboss', 'Sketch', 'Sky Blue', 'Grass Green', 'Skin Whiten', 'Vivid', 'Aqua', 'Art Freeze', 'Silhouette', 'Solarization', 'Antique', 'Set Cb/Cr'] }),                   // min=0 max=15 default=0 value=0 | 0: None,1: Black & White,2: Sepia,3: Negative,4: Emboss,5: Sketch,6: Sky Blue,7: Grass Green,8: Skin Whiten,9: Vivid,10: Aqua,11: Art Freeze,12: Silhouette,13: Solarization,14: Antique,15: Set Cb/Cr
      rotate: new UserControl(0, { range: { min: 0, max: 360 } }),                          // min=0 max=360 step=90 default=0 value=0
      color_effects_cbcr: new UserControl(32896, { range: { min: 0, max: 65535 } }),          // min=0 max=65535 step=1 default=32896 value=32896
    },
    CodecControls: {
      video_bitrate_mode: new UserControl(0, { set: [0, 1], lookup: ['Variable Bitrate', 'Constant Bitrate'] }),              // min=0 max=1 default=0 value=0 flags=update | 0: Variable Bitrate,1: Constant Bitrate
      video_bitrate: new UserControl(10000000, { range: { min: 25000, max: 25000000, step: 25000 } }),            // min=25000 max=25000000 step=25000 default=10000000 value=10000000
      repeat_sequence_header: new UserControl(false, { stringify: stringifyBool }),      // default=0 value=0
      h264_i_frame_period: new UserControl(60, { range: { min: 0, max: 2147483647 } }),            // min=0 max=2147483647 step=1 default=60 value=60
      h264_level: new UserControl(11, { set: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], lookup: ['1', '1b', '1.1', '1.2', '1.3', '2', '2.1', '2.2', '3', '3.1', '3.2', '4'] }),                     // min=0 max=11 default=11 value=11 | 0:1,1:1b,2:1.1,3:1.2,4:1.3,5:2,6:2.1,7:2.2,8:3,9:3.1,10:3.2,11:4
      h264_profile: new UserControl(4, { set: [0, 1, 2, 4], lookup: ['Baseline', 'Constrained Baseline', 'Main', 'High'] })                     // min=0 max=4 default=4 value=4 | 0:Baseline,1:Constrained Baseline,2:Main,4:High
    },
    CameraControls: {
      auto_exposure: new UserControl(false, { stringify: stringifyBool }),                    // min=0 max=3 default=0 value=0
      exposure_time_absolute: new UserControl(1000, { range: { min: 0, max: 10000 } }),       // min=1 max=10000 step=1 default=1000 value=1000
      exposure_dynamic_framerate: new UserControl(false, { stringify: stringifyBool }),  // default=0 value=0
      auto_exposure_bias: new UserControl(12, { range: { min: 0, max: 24 } }),             // min=0 max=24 default=12 value=12
      white_balance_auto_preset: new UserControl(1, { set: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], lookup: ['Manual', 'Auto', 'Incandescent', 'Fluorescent', 'Fluorescent', 'Horizon', 'Daylight', 'Flash', 'Cloudy', 'Shade'] }),       // min=0 max=9 default=1 value=1 | 0:Manual,1:Auto,2:Incandescent,3:Fluorescent,4:Fluorescent,5:Horizon,6:Daylight,7:Flash,8:Cloudy,9:Shade
      image_stabilization: new UserControl(false, { stringify: stringifyBool }),         // default=0 value=0
      iso_sensitivity: new UserControl(0, { set: [0, 1, 2, 3, 4], lookup: ['0', '100', '200', '400', '800'] }),                 // min=0 max=4 default=0 value=0 | 0: 0,1: 100,2: 200,3: 400,4: 800,
      exposure_metering_mode: new UserControl(0, { set: [0, 1, 2], lookup: ['Average', 'Center Weighted', 'Spot'] }),          // min=0 max=2 default=0 value=0 | 0: Average,1: Center Weighted,2: Spot,
      scene_mode: new UserControl(0, { set: [0, 8, 11], lookup: ['None', 'Night', 'Sports'] })                       // min=0 max=13 default=0 value=0 | 0: None,8: Night,11: Sports
    },
    JPEGCompressionControls: {
      compression_quality: new UserControl(30, { range: { min: 1, max: 100 } })             // min=1 max=100 step=1 default=30 value=30
    }
  };
  
  export function SetControls() {
    var usercontrols = Controls.UserControls;
    var codeccontrols = Controls.CodecControls;
    var cameracontrols = Controls.CameraControls;
    var jpgcontrols = Controls.JPEGCompressionControls;

    var getChanges = function(controls:[]) {
      var changes = [];
      for (var c in controls) {
        var control = <UserControl<any>>controls[c];
        if (!control.isDirty
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
      utils.execSync(["sudo v4l2-ctl --set-ctrl ", changedcontrols.join(',')].join(''));
  };
  
  export function GetControls() {
    var settings = utils.execSync("v4l2-ctl -l").toString();
    var regexPart = ".*value=([0-9]*)";

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
  };
}

export = v4l2ctl;