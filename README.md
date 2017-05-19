# RPOS
Node.js based ONVIF Camera/NVT service. (http://www.onvif.org) 
Runs on a range of operating systems that support NodeJS with special support for the Raspberry Pi, the Pi Camera and the Pimoroni Pan-Tilt HAT.

## History
The initial goal (by @BreeeZe) was to provide a Onvif Media service which was compatible with Synology Surveillance Station to allow the Pi to be used as a surveillance camera without the need for adding any custom camera files to your Synology NAS.
First demo video @ https://youtu.be/ZcZbF4XOH7E

The next goal (by @RogerHardiman) was to implement more of the Onvif standard so that RPOS could be used with a wide range of CCTV systems and with ONVIF Device Manager and ONVIF Device Tool and to ensure SOAP messages were validated against the WSDL. Additional ONVIF Soap commands were added including the PTZ Service with backend drivers that control the Raspberry Pi Pan-Tit HAT made by Pimoroni or emit various PTZ protocols including Pelco D.

## node-soap
This version uses a patched version of the "node-soap" v0.80 library (https://github.com/vpulim/node-soap/releases/tag/v0.8.0) located @ https://github.com/BreeeZe/node-soap

## Features:
- ONVIF compatible Service to deliver live video to CCTV viewing software
- Streams H264 video over rtsp from the Raspberry Pi's camera (hardware h264 encoding)
- For other operating systems just run your own RTSP server for your video
- Pi Camera control (resolution and framerate) through Onvif 
- Set other Pi camera options through a web interface.
- Discoverable (WS-Discovery) on Pi/Linux
- Supports Unicast (UDP/TDP) and Multicast using mpromonet's RTSP server
- Works with ONVIF Device Manager (Windows) and ONVIF Device Tool (Linux)
- Works with other CCTV Viewing Software that implements the Onvif standard
- Implements PTZ service and controls the Pimononi Pan-Tilt HAT
- Also emits PTZ commands as as Pelco D and Visca on a serial port (UART)
- Implements Relay (digital output) function
- On Mac and Windows and other Linux machines you need to run your own RTSP server. An exaple to use ffserver on the Mac with the Macbook Camera is included.

## How to Install on a Raspberry Pi:

STEP 1 - PI
  Run ‘rasps-config’ and enable the camera and reboot
 
STEP 2 - GET NODEJS v6 from NODESOURCE and Live555
  curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
  sudo apt-get install nodejs
  sudo apt-get install liblivemedia-dev
 
  ((Note, this installs npm and node-legacy))
  ((Note, git is already installed on the Pi))


STEP 3 - GET RPOS SOURCE (using Roger Hardiman's fork with PTZ and bug fixes)
  git clone https://github.com/RogerHardiman/rpos.git

STEP 4 - CD into RPOS FOLDER
  cd rpos

STEP 5 - INSTALL RPOS Dependencies
  npm install

STEP 6 - COMPILE TYPESCRIPT TO JAVASCRIPT using local Gulp module
  ./node_modules/gulp/bin/gulp.js

STEP 7 - RECOMPILE the RTSP Server
  RPOS comes with a pre-compiled ARM binary for a simple RTSP server.
  The source in in the ‘cpp’ folder.
  However the mpromonet RTSP server has more options and can be installed by running this script
     sh setup_v4l2rtspserver.sh
 
STEP 8 - EDIT CONFIG
  Edit rposConf.json if you want to
    Change the ONVIF Service Port (where the Web Server and SOAP service live)
    Enable PTZ support eg for the Pan-Tilt HAT or Pelco D backends
    Enable multicast (and switch to the mpromonet RTSP server
    Enable a basic ONVIF/RTSP Gateway

STEP 9 - RUN (needs Root to load the camera module)
  sudo node rpos.js

STEP 10 - PAN-TILT HAT (Pimononi) USERS
  The camera on the Pan-Tilt hat is installed upside down.
  Goto the Web Page that runs with rpos http://rpos-ip:8081
  and tick the horizontal and vertial flip boxes and apply the changes


Then you start rpos by running "sudo node rpos.js"
sudo is neeeded as rpos loads the Broadcom Raspberry Pi camera drivers

## Camera settings
You can set camera settings by browsing to : http://CameraIP:Port/
These settings are then saved in a file called v4l2ctl.json and are persisted on rpos restart.

## Known Issues
- 1920x1080 can cause hangs and crashes.

## ToDo's
- Add authentication
- Add MJPEG
- Test against ONVIF's own comformance tools
- Implement more ONVIF calls (PTZ Abs Position, Events, Analytics)
- Add GPIO digital input
- and more...

## rpos-gateway
There is another project on github that is based on RPOS. It provides a simple ONVIF Gateway which delivers up RTSP addresses to ONVIF viewing software. https://github.com/kristian/rpos-gateway
