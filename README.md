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

### STEP 1 - ENABLE RASPBERRY PI CAMERA

Pi users can run ‘raspi-config’ and enable the camera and reboot  
Windows/Mac/Linux users can skip this step

### STEP 2 - INSTALL NODEJS AND NPM

NOTE: Node.js Version 6.x and 8.x have been tested with RPOS. Only a small amount of testing has been done with Node v10.

#### STEP 2.1.a - INSTALL NODE USING NVM

You may choose to use [Node Version Manager (NVM)](https://github.com/nvm-sh/nvm) to install & use a specific version of Node & NPM, such as `nvm install 8` instead of the latest. Follow the instructions on NVM's github page to install & use.

#### STEP 2.1.b - INSTALL NODE USING APT

Pi and Linux users can install latest versions of Node and NPM together with this command:

```
  sudo apt-get install npm
```

#### STEP 2.1.c - OTHER METHODS

Windows and Mac users can install Node from the nodejs.org web site.

Older Raspbian users (eg thouse running Jessie) can install NodeJS and NPM with these commands

```
  curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
  sudo apt-get install nodejs
```

#### STEP 2.2 - UPDATE NPM

If using NVM to manage your Node.js version, the following will update NPM to the latest supported on your version of Node.js:

```
nvm install-latest-npm
```

Otherwise you can use NPM to update itself the latest NPM with this command:

```
sudo npm install -g npm@latest
```

Note this seemed to fail first time and needed to be ran twice to get my onto NPM version 6.7.0

### STEP 3 - GET RPOS SOURCE, INSTALL DEPENDENCIES

```
git clone https://github.com/BreeeZe/rpos.git
cd rpos
npm install
```

### STEP 4 - COMPILE TYPESCRIPT(.ts) TO JAVASCRIPT(.js) using GULP

#### 4.1.a

For NPM version 5.2 and up, use the `npx` command to run the 'gulp' script:

```
npx gulp
```

#### 4.1.b

For older versions of NPM without `npx`, run the gulp script directly:

```
./node_modules/gulp/bin/gulp.js
```

### STEP 5 - PICK YOUR RTSP SERVER

RTSP Server options for Pi / Linux:

1. RPOS comes with a pre-compiled ARM binary for a simple RTSP server. The source is in the ‘cpp’ folder.
1. mpromonet RTSP Server (server option 2)
1. GStreamer RTSP Server (server option 3)

RTSP Server options 2 & 3 offer more features, but require additional setup. See instructions below.

Windows users will need to run their own RTSP Server.
Mac users can use the ffserver script.

Note: The choice of RTSP Server is made in rposConfig.json

#### STEP 5.a - USING PRE-COMPILED ARM BINARY (1)

Option 1: RPOS comes with a pre-compiled ARM binary for a simple RTSP server. The source is in the ‘cpp’ folder. No action required to use, this is pre-selected in `rpos_config.json`

Note that this option can be unstable, recommend option 2 or 3.

#### STEP 5.b - USING MPROMONET RTSP SERVER (2)

Option 2: Raspberry Pi and Linux users will probably prefer the mpromonet RTSP server, as it has more options and supports multicasting.
Install dependency and run this setup script:

```
sudo apt-get install liblivemedia-dev
sh setup_v4l2rtspserver.sh
```

#### STEP 5.c - USING GSTREAMER RTSP SERVER (server option 3)

Option 3: Install precompiled packages using apt, or compile them yourself.

Installing the packages using apt saves a lot of time, but provides a rather old gstreamer version.

##### 5.c.1a - INSTALL GSTREAMER USING APT:

```
sudo apt install git gstreamer1.0-plugins-bad gstreamer1.0-plugins-base \
 gstreamer1.0-plugins-good gstreamer1.0-plugins-ugly \
 gstreamer1.0-tools libgstreamer1.0-dev libgstreamer1.0-0-dbg \
 libgstreamer1.0-0 gstreamer1.0-omx \
 libgstreamer-plugins-base1.0-dev gtk-doc-tools
```

##### 5.c.1b - INSTALL GSTREAMER FROM SOURCE

(starting in /rpos root directory)

```
cd ..
git clone https://github.com/thaytan/gst-rpicamsrc.git
cd gst-rpicamsrc
./autogen.sh
make
sudo make install
cd ..
```

Check successful plugin installation by executing

```
gst-inspect-1.0 rpicamsrc
```

##### 5.c.2 - INSTALL GST-RTSP-SERVER FROM SOURCE

Next, compile gst-rtsp-server v1.4.5 (newer versions require newer GStreamer libs than those installed by apt)

```
git clone git://anongit.freedesktop.org/gstreamer/gst-rtsp-server
cd gst-rtsp-server
git checkout 1.4.5
./autogen.sh
make
sudo make install
```

Note: You do not need to load V4L2 modules when using rpicamsrc (option 3).

### STEP 6 - EDIT CONFIG

Edit `rposConf.json` to fit your application. Options include:

- Add a Username and Password for ONVIF access
- Change the TCP Port for the Camera configuration and the ONVIF Services
- Change the RTSP Port
- Enable PTZ support by selecting Pan-Tilt HAT or RS485 backends (Visca and Pelco D)
- Enable multicast
- Switch to the mpromonet or GStreamer RTSP servers
- Hardcode an IP address in the ONVIF SOAP messages

### STEP 7 - RUN RPOS.JS

#### First run

If you're using RTSP option 1 or 2, before you run RPOS for the first time you'll need to load the Pi V4L2 Camera Driver:

```
sudo modprobe bcm2835-v4l2
```

Initial setup is now complete!

#### Launch RPOS

To start the application:

```
node rpos.js
```

### STEP 8 - EXTRA CONFIGURATION ON PAN-TILT HAT (Pimononi)

The camera on the Pan-Tilt hat is usually installed upside down.
Goto the Web Page that runs with rpos `http://<CameraIP>:8081` and tick the horizontal and vertial flip boxes and apply the changes.

## Camera Settings

You can set camera settings by browsing to : `http://CameraIP:Port/`
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
