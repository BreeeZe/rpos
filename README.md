# rpos
Node.js based ONVIF Camera/NVT software that turns a Raspberry Pi, Windows, Linux or Mac computer into an ONVIF Camera and RTSP Server. It implements the key parts of Profile S and Profile T (http://www.onvif.org). It has special support for the Raspberry Pi Camera and Pimoroni Pan-Tilt HAT

RPOS won an award in the 2018 ONVIF Open Source Challenge competition.

## History
The initial goal (by @BreeeZe) was to provide a ONVIF Media service which is compatible with Synology Surveillance Station to allow the Raspberry Pi to be used as a surveillance camera without the need for adding any custom camera files to your Synology NAS.
First demo video @ https://youtu.be/ZcZbF4XOH7E

This version uses a patched version of the "node-soap" v0.80 library (https://github.com/vpulim/node-soap/releases/tag/v0.8.0) located @ https://github.com/BreeeZe/node-soap

The next goal (by @RogerHardiman) was to implement more of the ONVIF standard so that RPOS could be used with a wide range of CCTV systems and with ONVIF Device Manager and ONVIF Device Tool. Additional ONVIF Soap commands were added including the PTZ Service with backend drivers that control the Raspberry Pi Pan-Tit HAT or emit various RS485 based PTZ protocols including Pelco D and Sony Visca.

Oliver Schwaneberg added GStreamer gst-rtsp-server support as third RTSP Server option.

Casper Meijn added Relative PTZ support

## Features:
- Streams H264 video over rtsp from the Official Raspberry Pi camera (the one that uses the ribbon cable)
- Uses hardware H264 encoding (on the Pi)
- Camera control (resolution and framerate) through ONVIF 
- Set other camera options through a web interface.
- Discoverable (WS-Discovery) on Pi/Linux
- Works with ONVIF Device Manager (Windows) and ONVIF Device Tool (Linux)
- Works with other CCTV Viewing Software that implements the ONVIF standard including Antrica Decoder, Avigilon Control Centre, Bosch BVMS, Milestone, ISpy (Opensource), BenSoft SecuritySpy (Mac)
- Implements ONVIF Authentication
- Implements Absolute, Relative and Continuous PTZ service and controls the Pimononi Raspberry Pi Pan-Tilt HAT
- Also converts ONVIF PTZ commands into Pelco D and Visca telemetry on a serial port (UART) for other Pan/Tilt platforms
- Implements Imaging service Brightness and Focus commands (for Profile T)
- Implements Relay (digital output) function
- Supports Unicast (UDP/TDP) and Multicast using mpromonet's RTSP server
- Also runs on Mac and Windows and other Linux machines but you need to supply your own RTSP server. An example to use ffserver on the Mac is included.
- Currently does not support USB cameras (see Todo List)

![Picture of RPOS running on a Pi with the PanTiltHAT and Pi Camera](RPOS_PanTiltHAT.jpg?raw=true "PanTiltHAT")
Picture of RPOS running on a Pi 3 with the PiMoroni PanTiltHAT and Official Pi Camera


## How to Install on a Raspberry Pi:

STEP 1 - ENABLE RASPBERRY PI CAMERA  
Pi users can run ‘raspi-config’ and enable the camera and reboot  
Windows/Mac/Linux users can skip this step
 
STEP 2.1 - INSTALL NODEJS AND NPM
Pi and Linux users can install Node and NPM together with this command
```
   sudo apt-get install npm
```
Windows and Mac users can install Node from the nodejs.org web site.

Version 6.x and 8.x have been tested with RPOS. Only a small amount of testing has been done with Node v10.  

Older Raspbian users (eg thouse running Jessie) can install NodeJS and NPM with these commands  
```
  curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
  sudo apt-get install nodejs
```

STEP 2.2 - UPGRADE NPM  
Check you have upgraded to the latest NPM with this command  
```   sudo npm install -g npm@latest```  
Note this seemed to fail first time and needed to be ran twice to get my onto NPM version 6.7.0

STEP 3 - GET RPOS SOURCE, INSTALL DEPENDENCIES  
```  git clone https://github.com/BreeeZe/rpos.git```  
```  cd rpos```  
```  npm install```

STEP 4 - COMPILE TYPESCRIPT(.ts) TO JAVASCRIPT(.js) using GULP  
Usw npx to run the 'gulp' command. npx came with npm version 5.2 or higher
```npx gulp```  
If you do not have npx, use ```  ./node_modules/gulp/bin/gulp.js```

STEP 5 - PICK YOUR RTSP SERVER  
RPOS comes with a pre-compiled ARM binary for a simple RTSP server. The source is in the ‘cpp’ folder.  
But the mpromonet RTSP Server (server option 2) and the GStreamer RTSP Server (server option 3) offer more features using the build instructions below.  
Windows users will need to run their own RTSP Server.  
Mac users can use the ffserver script.  
Note:- The choice of RTSP Server is made in rposConfig.json

STEP 5.1 - USING MPROMONET RTSP SERVER - COMPILE the RTSP Server (server option 2)
RPOS comes with a pre-compiled ARM binary for a simple RTSP server. The source is in the ‘cpp’ folder.  
However Pi and Linux users will probably prefer the mpromonet RTSP server as has more options and supports multicasting.  
It can be installed and can be installed by running this script  
```   sudo apt-get install liblivemedia-dev```   
```   sh setup_v4l2rtspserver.sh```

STEP 5.2 - USING GSTREAMER RTSP SERVER - INSTALL RPICAMSRC and GST-RTSP-SERVER (server option 3)
  *  Install required packages using apt or compile them yourself.  
     Installing the packages using apt saves a lot of time, but provides a rather old gstreamer version.  
  *  Install using apt:
```
  sudo apt install git gstreamer1.0-plugins-bad gstreamer1.0-plugins-base \
                    gstreamer1.0-plugins-good gstreamer1.0-plugins-ugly \
                    gstreamer1.0-tools libgstreamer1.0-dev libgstreamer1.0-0-dbg \
                    libgstreamer1.0-0 gstreamer1.0-omx \
                    libgstreamer-plugins-base1.0-dev gtk-doc-tools
```
  *  Compile gst-rpicamsrc:   
```
  cd ..
  git clone https://github.com/thaytan/gst-rpicamsrc.git
  cd gst-rpicamsrc
  ./autogen.sh
  make
  sudo make install
  cd ..
```
  * Check successful plugin installation by executing ```gst-inspect-1.0 rpicamsrc```
  * Note: You do not need to load V4L2 modules when using rpicamsrc!
  * Compile gst-rtsp-server v1.4.5 
    (newer versions require newer GStreamer libs than those installed by apt)
```
  git clone git://anongit.freedesktop.org/gstreamer/gst-rtsp-server
  cd gst-rtsp-server
  git checkout 1.4.5
  ./autogen.sh
  make
  sudo make install
```

STEP 6 - EDIT CONFIG  
  *  Edit ``` rposConf.json ``` if you want to
  *  Add an ONVIF Username and Password
  *  Change the TCP Port for the Web Server and the ONVIF Service
  *  Change the RTSP Port
  *  Enable PTZ support eg for the Pan-Tilt HAT or RS485 backends (Visca and Pelco D)
  *  Enable multicast
  *  Switch to the mpromonet RTSP Server
  *  Switch to the GStreamer RTSP Server
  *  Enable a basic ONVIF/RTSP Gateway
  *  Hard code an IP address in the ONVIF SOAP messages

STEP 7 - RUN RPOS.JS  
 ``` sudo modprobe bcm2835-v4l2 ``` to load the Pi V4L2 Camera Driver  
 ``` node rpos.js ``` to run the Application  

STEP 8 - EXTRA CONFIGURATION ON PAN-TILT HAT (Pimononi)  
The camera on the Pan-Tilt hat is usually installed upside down.  
Goto the Web Page that runs with rpos ```http://<CameraIP>:8081``` and tick the horizontal and vertial flip boxes and apply the changes.


## Camera Settings
You can set camera settings by browsing to : ```http://CameraIP:Port/```  
These settings are then saved in a file called v4l2ctl.json and are persisted on rpos restart.  
The default port for RPOS is 8081.


## Known Issues
- 1920x1080 can cause hangs and crashes with the original RTSP server. The mpromonet one may work better.
- Not all of the ONVIF standard is implemented. 

## ToDo's (Help is Required)
- Add MJPEG (implemented in gst-rtsp-server but still needs to return the correct ONVIF XML for MJPEG)
- Support USB cameras with the Pi's Hardware H264 encoder (OMX) (see https://github.com/mpromonet/v4l2tools)
- Implement more ONVIF calls (Events, Analytics)
- Test with ONVIF's own test tools (need a sponsor for this as we do not have funds to buy it)
- Add GPIO digital input
- Add two way audio
- and more...


