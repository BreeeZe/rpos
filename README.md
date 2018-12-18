# rpos
Node.js based ONVIF Camera/NVT service that implements parts of Profile S and parts of Profile T (http://www.onvif.org). It has special support for the Raspberry Pi Camera and Pan-Tilt HAT and will also run on Windows, MacOS and Linux.

## History
The initial goal (by @BreeeZe) was to provide a Onvif Media service which is compatible with Synology Surveillance Station to allow the Pi to be used as a surveillance camera without the need for adding any custom camera files to your Synology NAS.
First demo video @ https://youtu.be/ZcZbF4XOH7E

The next goal (by @RogerHardiman) was to implement more of the Onvif standard so that RPOS could be used with a wide range of CCTV systems and with ONVIF Device Manager and ONVIF Device Tool. Additional ONVIF Soap commands were added including the PTZ Service with backend drivers that control the Raspberry Pi Pan-Tit HAT or emit various RS485 based PTZ protocols including Pelco D and Sony Visca.

This version uses a patched version of the "node-soap" v0.80 library (https://github.com/vpulim/node-soap/releases/tag/v0.8.0) located @ https://github.com/BreeeZe/node-soap

Added gst-rtsp-server support as third option by Oliver Schwaneberg

## Features:
- Streams H264 video over rtsp from the Official Raspberry Pi camera (the one that uses the ribbon cable)
- Uses hardware H264 encoding (on the Pi)
- Camera control (resolution and framerate) through ONVIF 
- Set other camera options through a web interface.
- Discoverable (WS-Discovery) on Pi/Linux
- Works with ONVIF Device Manager (Windows) and ONVIF Device Tool (Linux)
- Works with other CCTV Viewing Software that implements the ONVIF standard including Antrica Decoder, Avigilon Control Centre, Bosch BVMS, Milestone, ISpy (Opensource), BenSoft SecuritySpy (Mac)
- Implements PTZ service and controls the Pimononi Raspberry Pi Pan-Tilt HAT
- Also emits PTZ commands as as Pelco D and Visca on a serial port (UART) for other Pan/Tilt platforms
- Implements Imaging service Brightness and Focus commands (for Profile T)
- Implements Relay (digital output) function
- Supports Unicast (UDP/TDP) and Multicast using mpromonet's RTSP server
- Also runs on Mac and Windows and other Linux machines but you need to supply your own RTSP server. An example to use ffserver on the Mac is included.
- Currently does not support USB cameras (see Todo List)

![Picture of RPOS running on a Pi with the PanTiltHAT and Pi Camera](RPOS_PanTiltHAT.jpg?raw=true "PanTiltHAT")
Picture of RPOS running on a Pi 3 with the PiMoroni PanTiltHAT and Official Pi Camera


## How to Install on a Raspberry Pi:

STEP 1 - PI
  Run ‘raspi-config’ and enable the camera and reboot
 
STEP 2 - GET NODEJS v6 from NODESOURCE and Live555
```
  curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
  sudo apt-get install nodejs
  sudo apt-get install liblivemedia-dev
```
 
  ((Note, this installs npm and node-legacy))
  ((Note, git is already installed on the Pi))

STEP 3 - GET RPOS SOURCE
```  git clone https://github.com/BreeeZe/rpos.git```

STEP 4 - CD into RPOS FOLDER
```  cd rpos```

STEP 5 - INSTALL RPOS Dependencies
```  npm install```

STEP 6 - COMPILE TYPESCRIPT TO JAVASCRIPT using local Gulp module
```  ./node_modules/gulp/bin/gulp.js```

STEP 7.1 - RECOMPILE the RTSP Server (server option 2)
  RPOS comes with a pre-compiled ARM binary for a simple RTSP server.
  The source is in the ‘cpp’ folder.
  However the mpromonet RTSP server has more options and can be installed by running this script
```     sh setup_v4l2rtspserver.sh```

STEP 7.2 - INSTALL RPICAMSRC and GST-RTSP-SERVER (server option 3)
  *  Install required packages:
```
  sudo apt install git gstreamer1.0-plugins-bad gstreamer1.0-plugins-base \
                    gstreamer1.0-plugins-good gstreamer1.0-plugins-ugly \
                    gstreamer1.0-tools libgstreamer1.0-dev libgstreamer1.0-0-dbg \
                    libgstreamer1.0-0 gstreamer1.0-omx \
                    libgstreamer-plugins-base1.0-dev gtk-doc-tools
  *  Compile gst-rpicamsrc:
  cd ..
  git clone https://github.com/thaytan/gst-rpicamsrc.git
  cd gst-rpicamsrc
  ./autogen.sh
  make
  sudo make install
```
  * Check successful plugin installation by executing ```gst-inspect-1.0 rpicamsrc```
  *  Note: Do not load V4L2 modules when using rpicamsrc!
  * Compile gst-rtsp-server v1.4.5 (newer versions require newer GStreamer libs)
```
  git clone git://anongit.freedesktop.org/gstreamer/gst-rtsp-server
  cd gst-rtsp-server
  git checkout 1.4.5
  ./autogen.sh
  make
  sudo make install
```

STEP 8 - EDIT CONFIG
  *  Edit ``` rposConf.json``` if you want to
  *  Change the ONVIF Service Port (where the Web Server and SOAP service live)
  *  Enable PTZ support eg for the Pan-Tilt HAT or Pelco D backends
  *  Enable multicast (and switch to the mpromonet RTSP server
  *  Enable a basic ONVIF/RTSP Gateway

STEP 9 - RUN (needs Root to load the camera module)
```  sudo node rpos.js```

STEP 10 - PAN-TILT HAT (Pimononi) USERS
  The camera on the Pan-Tilt hat is installed upside down.
  Goto the Web Page that runs with rpos http://rpos-ip:8081
  and tick the horizontal and vertial flip boxes and apply the changes

Then you start rpos by running ```sudo node rpos.js```
sudo is required so the broadcom driver fort the camera can load.

#Camera settings
You can set camera settings by browsing to : http://CameraIP:Port/
These settings are then saved in a file called v4l2ctl.json and are persisted on rpos restart.

## Known Issues
- 1920x1080 can cause hangs and crashes with the original RTSP server. The mpromonet one may work better
- Not all of the ONVIF standard is implemented

## ToDo's (Help is Required)
- Add authentication
- Add MJPEG (implemented in gst-rtsp-server)
- Support USB cameras with the Pi's Hardware H264 encoder (OMX) (see https://github.com/mpromonet/v4l2tools)
- Implement more ONVIF calls (PTZ Abs Position, Events, Analytics)
- Test with ONVIF's own test tools (need a sponsor for this as we do not have funds to buy it)
- Add GPIO digital input
- Add two way audio
- and more...

## rpos-gateway
There is another project on github that is based on RPOS. It provides a simple ONVIF Gateway which delivers up RTSP addresses to ONVIF viewing software. https://github.com/kristian/rpos-gateway

