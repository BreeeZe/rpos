var property = require('./utils').property;
var utils = require('./utils');

var stringifyBool = function (v) { return v ? "1" : "0"; }

var v4l2ctl = {
  Controls : {
    UserControls : {
      brightness: new property(50, { range : { min : 0, max : 100 } }),                     // min=0 max=100 step=1 default=50 value=50 flags=slider
      contrast: new property(0, { range : { min : -100, max : 100 } }),                        // min=-100 max=100 step=1 default=0 value=0 flags=slider
      saturation: new property(0, { range : { min : -100, max : 100 } }),                      // min=-100 max=100 step=1 default=0 value=0 flags=slider
      red_balance: new property(1000, { range : { min : 1, max : 7999 } }),                  // min=1 max=7999 step=1 default=1000 value=1000 flags=slider
      blue_balance: new property(1000, { range : { min : 1, max : 7999 } }),                 // min=1 max=7999 step=1 default=1000 value=1000 flags=slider
      horizontal_flip: new property(false, { stringify : stringifyBool }),             // default=0 value=0
      vertical_flip: new property(true, { stringify : stringifyBool }),               // default=0 value=0
      power_line_frequency: new property(1, { set : [0, 1, 2, 3], lookup : ['Disabled', '50 Hz', '60 Hz', 'Auto'] }),            // min=0 max=3 default=1 value=1 | 0: Disabled,1: 50 Hz,2: 60 Hz,3: Auto
      sharpness: new property(0, { range : { min : -100, max : 100 } }),                       // min=-100 max=100 step=1 default=0 value=0 flags=slider
      color_effects: new property(0, { set : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], lookup : ['None', 'Black & White', 'Sepia', 'Negative', 'Emboss', 'Sketch', 'Sky Blue', 'Grass Green', 'Skin Whiten', 'Vivid', 'Aqua', 'Art Freeze', 'Silhouette', 'Solarization', 'Antique', 'Set Cb/Cr'] }),                   // min=0 max=15 default=0 value=0 | 0: None,1: Black & White,2: Sepia,3: Negative,4: Emboss,5: Sketch,6: Sky Blue,7: Grass Green,8: Skin Whiten,9: Vivid,10: Aqua,11: Art Freeze,12: Silhouette,13: Solarization,14: Antique,15: Set Cb/Cr
      rotate: new property(0, { range : { min : 0, max : 360 } }),                          // min=0 max=360 step=90 default=0 value=0
      color_effects_cbcr: new property(32896, { range : { min : 0, max : 65535 } }),          // min=0 max=65535 step=1 default=32896 value=32896
    },
    CodecControls : {
      video_bitrate_mode: new property(0, { set : [0, 1], lookup : ['Variable Bitrate', 'Constant Bitrate'] }),              // min=0 max=1 default=0 value=0 flags=update | 0: Variable Bitrate,1: Constant Bitrate
      video_bitrate: new property(10000000, { range : { min : 25000, max : 25000000, step : 25000 } }),            // min=25000 max=25000000 step=25000 default=10000000 value=10000000
      repeat_sequence_header: new property(false, { stringify : stringifyBool }),      // default=0 value=0
      h264_i_frame_period: new property(60, { range : { min : 0, max : 2147483647 } }),            // min=0 max=2147483647 step=1 default=60 value=60
      h264_level: new property(11, { set : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], lookup : ['1', '1b', '1.1', '1.2', '1.3', '2', '2.1', '2.2', '3', '3.1', '3.2', '4'] }),                     // min=0 max=11 default=11 value=11 | 0:1,1:1b,2:1.1,3:1.2,4:1.3,5:2,6:2.1,7:2.2,8:3,9:3.1,10:3.2,11:4
      h264_profile: new property(4, { set : [0, 1, 2, 4], lookup : ['Baseline', 'Constrained Baseline', 'Main', 'High'] })                     // min=0 max=4 default=4 value=4 | 0:Baseline,1:Constrained Baseline,2:Main,4:High
    },
    CameraControls : {
      auto_exposur: new property(0, { range : { min : 0, max : 3 } }),                    // min=0 max=3 default=0 value=0
      exposure_time_absolute: new property(1000, { range : { min : 0, max : 10000 } }),       // min=1 max=10000 step=1 default=1000 value=1000
      exposure_dynamic_framerate: new property(false, { stringify : stringifyBool }),  // default=0 value=0
      auto_exposure_bias: new property(12, { range : { min : 0, max : 24 } }),             // min=0 max=24 default=12 value=12
      white_balance_auto_preset: new property(1, { set : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], lookup : ['Manual', 'Auto', 'Incandescent', 'Fluorescent', 'Fluorescent', 'Horizon', 'Daylight', 'Flash', 'Cloudy', 'Shade'] }),       // min=0 max=9 default=1 value=1 | 0:Manual,1:Auto,2:Incandescent,3:Fluorescent,4:Fluorescent,5:Horizon,6:Daylight,7:Flash,8:Cloudy,9:Shade
      image_stabilization: new property(false, { stringify : stringifyBool }),         // default=0 value=0
      iso_sensitivity: new property(0, { set : [0, 1, 2, 3, 4], lookup : ['0', '100', '200', '400', '800'] }),                 // min=0 max=4 default=0 value=0 | 0: 0,1: 100,2: 200,3: 400,4: 800,
      exposure_metering_mode: new property(0, { set : [0, 1, 2], lookup : ['Average', 'Center Weighted', 'Spot'] }),          // min=0 max=2 default=0 value=0 | 0: Average,1: Center Weighted,2: Spot,
      scene_mode: new property(0, { set : [0, 8, 11], lookup : ['None', 'Night', 'Sports'] })                       // min=0 max=13 default=0 value=0 | 0: None,8: Night,11: Sports
    },
    JPEGCompressionControls : {
      compression_quality: new property(30, { range : { min : 1, max : 100 } })             // min=1 max=100 step=1 default=30 value=30
    }
  },
  SetControls: function () {
    var usercontrols = v4l2ctl.Controls.UserControls;
    var codeccontrols = v4l2ctl.Controls.CodecControls;
    var cameracontrols = v4l2ctl.Controls.CameraControls;
    var jpgcontrols = v4l2ctl.Controls.JPEGCompressionControls;
    
    var changedcontrols = [];
    
    var getChanges = function (controls) {
      var changes = [];
      for (var c in controls) {
        var control = controls[c];
        if (!control.isDirty())
          continue;
        
        changes.push([c, "=", control].join(''));
        control.reset();
      }
      return changes;
    }
    
    changedcontrols = changedcontrols.concat(getChanges(usercontrols));
    changedcontrols = changedcontrols.concat(getChanges(codeccontrols));
    changedcontrols = changedcontrols.concat(getChanges(cameracontrols));
    changedcontrols = changedcontrols.concat(getChanges(jpgcontrols));

    if(changedcontrols.length > 0)
      utils.execSync(["sudo v4l2-ctl --set-ctrl ", changedcontrols.join(',')].join(''));
  }
  //v4l2-ctl --get-ctrl
};

module.exports = v4l2ctl;