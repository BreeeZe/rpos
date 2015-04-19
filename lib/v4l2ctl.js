var v4l2ctl = {
  Controls : {
    UserControls : {
      brightness: 50,                     // min=0 max=100 step=1 default=50 value=50 flags=slider
      contrast: 0,                        // min=-100 max=100 step=1 default=0 value=0 flags=slider
      saturation: 0,                      // min=-100 max=100 step=1 default=0 value=0 flags=slider
      red_balance: 1000,                  // min=1 max=7999 step=1 default=1000 value=1000 flags=slider
      blue_balance: 1000,                 // min=1 max=7999 step=1 default=1000 value=1000 flags=slider
      horizontal_flip: false,             // default=0 value=0
      vertical_flip: false,               // default=0 value=0
      power_line_frequency: 1,            // min=0 max=3 default=1 value=1 | 0: Disabled,1: 50 Hz,2: 60 Hz,3: Auto
      sharpness: 0,                       // min=-100 max=100 step=1 default=0 value=0 flags=slider
      color_effects: 0,                   // min=0 max=15 default=0 value=0 | 0: None,1: Black & White,2: Sepia,3: Negative,4: Emboss,5: Sketch,6: Sky Blue,7: Grass Green,8: Skin Whiten,9: Vivid,10: Aqua,11: Art Freeze,12: Silhouette,13: Solarization,14: Antique,15: Set Cb/Cr
      rotate: 0,                          // min=0 max=360 step=90 default=0 value=0
      color_effects_cbcr: 32896,          // min=0 max=65535 step=1 default=32896 value=32896
    },
    CodecControls : {
      video_bitrate_mode: 0,              // min=0 max=1 default=0 value=0 flags=update | 0: Variable Bitrate,1: Constant Bitrate
      video_bitrate: 10000000,            // min=25000 max=25000000 step=25000 default=10000000 value=10000000
      repeat_sequence_header: false,      // default=0 value=0
      h264_i_frame_period: 60,            // min=0 max=2147483647 step=1 default=60 value=60
      h264_level: 11,                     // min=0 max=11 default=11 value=11 | 0:1,1:1b,2:1.1,3:1.2,4:1.3,5:2,6:2.1,7:2.2,8:3,9:3.1,10:3.2,11:4
      h264_profile: 4                     // min=0 max=4 default=4 value=4 | 0:Baseline,1:Constrained Baseline,2:Main,4:High
    },
    CameraControls : {
      auto_exposur: 0,                    // min=0 max=3 default=0 value=0
      exposure_time_absolute: 1000,       // min=1 max=10000 step=1 default=1000 value=1000
      exposure_dynamic_framerate: false,  // default=0 value=0
      auto_exposure_bias: 12,             // min=0 max=24 default=12 value=12
      white_balance_auto_preset: 1,       // min=0 max=9 default=1 value=1 | 0:Manual,1:Auto,2:Incandescent,3:Fluorescent,4:Fluorescent,5:Horizon,6:Daylight,7:Flash,8:Cloudy,9:Shade
      image_stabilization: false,         // default=0 value=0
      iso_sensitivity: 0,                 // min=0 max=4 default=0 value=0 | 0: 0,1: 100,2: 200,3: 400,4: 800,
      exposure_metering_mode: 0,          // min=0 max=2 default=0 value=0 | 0: Average,1: Center Weighted,2: Spot,
      scene_mode: 0                       // min=0 max=13 default=0 value=0 | 0: None,8: Night,11: Sports
    },
    JPEGCompressionControls : {
      compression_quality: 30             // min=1 max=100 step=1 default=30 value=30
    }
  },

  //v4l2-ctl --get-ctrl
};

module.exports = v4l2ctl;