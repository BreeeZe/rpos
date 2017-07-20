# rpos
Node.js based ONVIF Camera/NVT service. (http://www.onvif.org) 
Runs on a range of operating systems that support NodeJS
with special support for the Raspberry Pi Camera and Pan-Tilt HAT

## History
The initial goal (by @BreeeZe) was to provide a Onvif Media service which is compatible with Synology Surveillance Station to allow the Pi to be used as a surveillance camera without the need for adding any custom camera files to your Synology NAS.
First demo video @ https://youtu.be/ZcZbF4XOH7E

The next goal (by @RogerHardiman) was to implement more of the Onvif standard so that RPOS could be used with a wide range of CCTV systems and with ONVIF Device Manager and ONVIF Device Tool. Additional ONVIF Soap commands were added including the PTZ Service with backend drivers that control the Raspberry Pi Pan-Tit HAT or emit various PTZ protocols including Pelco D.

This version uses a patched version of the "node-soap" v0.80 library (https://github.com/vpulim/node-soap/releases/tag/v0.8.0) located @ https://github.com/BreeeZe/node-soap

## Features:
- Streams H264 video over rtsp from the Official Raspberry Pi camera (the one that uses the ribbon cable)
- Uses hardware H264 encoding (on the Pi)
- Camera control (resolution and framerate) through Onvif 
- Set other camera options through a web interface.
- Discoverable (WS-Discovery) on Pi/Linux
- Works with ONVIF Device Manager (Windows) and ONVIF Device Tool (Linux)
- Works with other CCTV Viewing Software that implements the Onvif standard
- Implements PTZ service and controls the Pimononi Raspberry Pi Pan-Tilt HAT
- Also emits PTZ commands as as Pelco D and Visca on a serial port (UART) for other Pan/Tilt platforms
- Implements Relay (digital output) function
- Supports Unicast (UDP/TDP) and Multicast using mpromonet's RTSP server
- Also runs on Mac and Windows and other Linux machines but you need to supply your own RTSP server. An exaple to use ffserver on the Mac is included.
- Currently does not support USB cameras (see Todo List)

![Picture of RPOS running on a Pi with the PanTiltHAT and Pi Camera](RPOS_PanTiltHAT.jpg?raw=true "PanTiltHAT")
Picture of RPOS running on a Pi 3 with the PiMoroni PanTiltHAT and Official Pi Camera


## How to Install on a Raspberry Pi:

STEP 1 - PI
  Run ‘rasps-config’ and enable the camera and reboot
 
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

STEP 7 - RECOMPILE the RTSP Server
  RPOS comes with a pre-compiled ARM binary for a simple RTSP server.
  The source in in the ‘cpp’ folder.
  However the mpromonet RTSP server has more options and can be installed by running this script
```     sh setup_v4l2rtspserver.sh```
 
STEP 8 - EDIT CONFIG
  Edit rposConf.json if you want to
    Change the ONVIF Service Port (where the Web Server and SOAP service live)
    Enable PTZ support eg for the Pan-Tilt HAT or Pelco D backends
    Enable multicast (and switch to the mpromonet RTSP server
    Enable a basic ONVIF/RTSP Gateway

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
- 1920x1080 can cause hangs and crashes.
- Not all of the ONVIF standard is implemented

## ToDo's
- Add authentication
- Add MJPEG
- Support USB cameras with the Pi's Hardware H264 encoder (OMX) (see https://github.com/mpromonet/v4l2tools)
- Implement more ONVIF calls (PTZ Abs Position, Events, Analytics)
- Test with ONVIF's own test tools (need a sponsor for this)
- Add GPIO digital input
- and more...

## rpos-gateway
There is another project on github that is based on RPOS. It provides a simple ONVIF Gateway which delivers up RTSP addresses to ONVIF viewing software. https://github.com/kristian/rpos-gateway

