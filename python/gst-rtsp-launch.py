#!/usr/bin/python
# --------------------------------------------------------------------------- # 
# Supporting arguments
# --------------------------------------------------------------------------- # 
import argparse
parser = argparse.ArgumentParser(description="gst-rtsp-launch-py V0.2")
parser.add_argument('-v', '--verbose', action='store_true', help='Make script chatty')
parser.add_argument('-f', '--file', action='store', default="v4l2ctl.json", help='Video Configuration file')
parser.add_argument('-t', '--type', action='store', default="picam", help='picam, usbcam, filesrc or testsrc')
parser.add_argument('-d', '--device', action='store', default="/dev/video0", help='Video Device eg /dev/video0 or File eg /home/pi/testimage.jpg')
parser.add_argument('-P', '--rtspport', action='store', default=554, help='Set RTSP port')
parser.add_argument('-u', '--rtspname', action='store', default="live", help='Set RTSP name')
parser.add_argument('-W', '--rtspresolutionwidth', action='store', type=int, default=None, help='Set RTSP resolution width')
parser.add_argument('-H', '--rtspresolutionheight', action='store', type=int, default=None, help='Set RTSP resolution height')
parser.add_argument('-F', '--rtspframerate', action='store', type=int, default=None, help='Set RTSP framerate')
parser.add_argument('-p', '--pattern', action='store', default=None, help='ball, colorbars, image or file')
parser.add_argument('-S', '--preset', action='store', default=None, help='1080p, 720p or 480p')
parser.add_argument('-M', '--mjpeg', action='store_true', help='Start with MJPEG codec')
args = parser.parse_args()


# --------------------------------------------------------------------------- # 
# configure the service logging
# --------------------------------------------------------------------------- # 
import logging
logging.basicConfig()
log = logging.getLogger()

# --------------------------------------------------------------------------- # 
# import misc standard libraries
# --------------------------------------------------------------------------- # 
import json
import time
import os.path
import subprocess
import signal
import sys

from ctypes import *

if args.verbose:
	log.setLevel(logging.DEBUG)
else:
	log.setLevel(logging.INFO)

# --------------------------------------------------------------------------- # 
# Use gi to import GStreamer functionality
# --------------------------------------------------------------------------- # 
import gi
gi.require_version('Gst','1.0')
gi.require_version('GstRtspServer','1.0')
gi.require_version('GstVideo','1.0')
from gi.repository import GObject, Gst, Gio, GstVideo, GstRtspServer, GLib

from threading import Thread, Lock
cam_mutex = Lock()
# -------------------

class StreamServer:
	def __init__(self, type, device, file, port, name, width, height, codec, pattern=None, preset=None, framerate=None):
		signal.signal(signal.SIGTERM, self.exit_gracefully)
		Gst.init(None)
		self.mainloop = GObject.MainLoop()
		self.server = GstRtspServer.RTSPServer()
		self.mounts = self.server.get_mount_points()
		
		self.device = device
		self.type = type
		self.file = file

		self.port = port
		self.name = name

		self.pattern = (pattern or "ball").lower()
		self.preset = preset.lower() if preset else None

		self.factory = GstRtspServer.RTSPMediaFactory()
		# Factory must be shared to allow multiple connections
		self.factory.set_shared(True)
		self.context_id = 0
		self.running = False
		self.stayAwake = True
		
		GObject.threads_init()
		log.info("StreamServer initialized")
		
		self.codec_options = {0:"h264", 1:"MJPEG"}
		self.codec = codec
		
		# Declaring stream settings and initialize with safe default values
		self.bitrate_range = [200000, 20000000]
		self.bitrate = 5000000
		
		# dynamic range compression
		self.drc_options = {0:"off", 1:"low", 2:"medium", 3:"high"}
		self.drc = 3
		
		# key frame control (autmoatic = -1)
		self.h264_i_frame_period_range = [-1, 60]
		self.h264_i_frame_period = 15
		
		# Shutter speed
		#	0: 				Automatic (default)
		#	1 to 10000000:	Fixed shutter speed in microseconds
		self.shutter_range = [0, 10000001]
		self.shutter = 0
		
		# ISO level
		#	0:				Automatic (default)
		#	100 to 3200:	Fixed ISO mode
		self.iso_options = {0:"auto", 100:"ISO 100", 200:"ISO 200", 400:"ISO 400", 800:"ISO 800"}
		self.iso = 0
		
		##################################################################################################################################################################
		# Sharpness
		#	0 to 100: Tweak sharpness filter (default=0)
		self.sharpness_range = [0, 100]
		self.sharpness = 0
		
		##################################################################################################################################################################
		# Birghtness
		#	0 to 100: Tweak brightness (default=50)
		self.brightness_range = [0, 100]
		self.brightness = 50
		
		##################################################################################################################################################################
		# Saturation
		#	0 to 100: Tweak saturation (default=0)
		self.saturation_range = [0, 100]
		self.saturation = 0
		
		##################################################################################################################################################################
		# Contrast
		#	0 to 100: Tweak contrast (default=0 for video stream)
		self.contrast_range = [0, 100]
		self.contrast = 0
		
		##################################################################################################################################################################
		# Frames per second
		#	15 to 90: >30fps only available at 640x480
		self.fps = int(framerate) if framerate else 30
		self.fps_range = [15, 90]
		
		self.horizontal_mirroring 	= False
		self.vertical_mirroring 	= False
		self.video_stabilisation	= False
		
		# White balance
		#	000:			Off
		#	001:			Automatic (default)
		#	002:			sunlight
		#	003:			Cloudy
		#	004:			Shade
		#	005:			Tungsten bulp
		#	006:			Fluorescent
		#	007:			Incandescent
		#	008:			Xenon flash
		#	009:			Horizon
		self.white_balance_options = {0:"Off", 1:"auto", 2:"sunlight", 3:"cloudy", 4:"shade", 5:"tungsten", 6:"flourescent", 7:"incandescent", 8:"xenon", 9:"horizon"}
		self.white_balance = 1
		
		# RGB channels might be controlled individually, if white balance mode is "Off"
		self.gain_red_range = [0.0, 8.0]
		self.gain_red = 1.0
		self.gain_green_range = [0.0, 8.0]
		self.gain_green = 1.0
		self.gain_blue_range = [0.0, 8.0]
		self.gain_blue = 1.0
		
		self.width_options = {0:640, 1:800, 2:1024, 3:1280, 4:1640, 5:1920}
		self.default_width = 1280
		self.width = width
		self.height_options = {0:480, 1:600, 2:720, 3:768, 4:1024, 5:1232, 6:1080}
		self.default_height = 720
		self.height = height
		self.apply_preset()
		
		self.rotation = 0
		
		self.configDate = 0
	
	def exit_gracefully(self, signum, frame):
		self.stop()
		self.stayAwake = False
	
	def check_range(self, value, value_range):
		return value >= value_range[0] and value <= value_range[1]

	def check_option(self, option, options):
		return options.has_key(option)

	def apply_preset(self):
		preset_map = {"1080p": (1920, 1080), "720p": (1280, 720), "480p": (640, 480)}
		preset_dims = preset_map.get(self.preset)
		if preset_dims and (self.width is None or self.height is None):
			self.width = self.width if self.width is not None else preset_dims[0]
			self.height = self.height if self.height is not None else preset_dims[1]
		if self.width is None:
			self.width = self.default_width
		if self.height is None:
			self.height = self.default_height

	def readConfig(self):
		try:
			with open(self.file, 'r') as file:
				# Filter out special characters that break the json parser
				filter = ''.join(e for e in file.read() \
					if e.isalnum() \
					or e.isdigit() \
					or e.isspace() \
					or e == '"' or e == ':' or e == '.' or e == ',' \
					or e == '#' or e == '(' or e == ')' or e == '{' \
					or e == '}' or e == '[' or e == ']' \
					or e == '-' or e == '_')
				config = json.loads(filter)
				log.info("Video settings loaded from "+str(self.file))
				self.configDate = os.stat(self.file).st_mtime
				
				if self.check_range(config["CodecControls"]["video_bitrate"], self.bitrate_range):
					self.bitrate = config["CodecControls"]["video_bitrate"]
				else:
					log.error("bitrate out of range: " + str(config["CodecControls"]["video_bitrate"]))
				
				if self.check_range(config["CodecControls"]["h264_i_frame_period"], self.h264_i_frame_period_range):
					self.h264_i_frame_period = config["CodecControls"]["h264_i_frame_period"]
				else:
					log.error("i-frame period invalid: " + str(config["CodecControls"]["h264_i_frame_period"]))
				
				if self.check_range(config["UserControls"]["brightness"], self.brightness_range):
					self.brightness = config["UserControls"]["brightness"]
				else:
					log.error("brightness out of range: " + str(config["UserControls"]["brightness"]))
					
				if self.check_range(config["UserControls"]["contrast"], self.contrast_range):
					self.contrast = config["UserControls"]["contrast"]
				else:
					log.error("contrast out of range: " + str(config["UserControls"]["contrast"]))
				
				if self.check_range(config["UserControls"]["saturation"], self.saturation_range):
					self.saturation = config["UserControls"]["saturation"]
				else:
					log.error("saturation out of range: " + str(config["UserControls"]["saturation"]))
				
				if self.check_range(config["UserControls"]["sharpness"], self.sharpness_range):
					self.sharpness = config["UserControls"]["sharpness"]
				else:
					log.error("sharpness out of range: " + str(config["UserControls"]["sharpness"]))
				
				if self.check_range(config["UserControls"]["red_balance"] / 1000.0, self.gain_red_range):
					self.gain_red = config["UserControls"]["red_balance"] / 1000.0
				else:
					log.error("red balance out of range: " + str(config["UserControls"]["red_balance"] / 1000.0))
				
				if self.check_range(config["UserControls"]["blue_balance"] / 1000.0, self.gain_blue_range):
					self.gain_blue = config["UserControls"]["blue_balance"] / 1000.0
				else:
					log.error("blue balance out of range: " + str(config["UserControls"]["blue_balance"] / 1000.0))
				
				self.horizontal_mirroring = config["UserControls"]["horizontal_flip"]
				self.vertical_mirroring = config["UserControls"]["vertical_flip"]
				self.rotation = config["UserControls"]["rotate"]
				
				if config["CameraControls"]["auto_exposure"] == False and self.check_range(config["CameraControls"]["exposure_time_absolute"], self.saturation_range):
					self.shutter = config["CameraControls"]["exposure_time_absolute"]
				else:
					self.shutter = 0
				
				if self.check_option(config["CameraControls"]["white_balance_auto_preset"], self.white_balance_options):
					self.white_balance = config["CameraControls"]["white_balance_auto_preset"]
				else:
					log.error("Invalid AWB preset: "+str(config["CameraControls"]["white_balance_auto_preset"]))
					self.white_balance = 1
				
				if self.check_option(config["CameraControls"]["iso_sensitivity"], self.iso_options):
					self.iso = config["CameraControls"]["iso_sensitivity"]
				else:
					log.error("invalid ISO option: " + str(config["CameraControls"]["iso_sensitivity"]))
					self.iso = 0
				
				self.video_stabilisation = config["CameraControls"]["image_stabilization"]
				
				# These settings will be ignored:
				self.bitrate_mode = config["CodecControls"]["video_bitrate_mode"]
				self.repeat_sequence_header = config["CodecControls"]["repeat_sequence_header"]
				self.h264_level = config["CodecControls"]["h264_level"]
				self.h264_profile = config["CodecControls"]["h264_profile"]
		except Exception as e:
			print ("Unable to read config!")
			print (e)
			
	
	def launch(self):
		log.debug("StreamServer.launch")
		if self.running:
			log.debug("StreamServer.launch called on running instance.")
			self.stop() # Need to stop any instances first
		
		if self.type == "picam":
		        # This asks the Pi GPU to generate H264 video data which is then passed out via RTSP
		        # Because the pipleline receives H264 video data (NALs) is not possible to add the clock overlay
		        # To add a clock, we must get raw video from the GPU and then add the clock, and then pass into the GPU to encode (or use libx264 to encode in software)

			launch_str = 	'( rpicamsrc preview=false bitrate='+str(self.bitrate)+' keyframe-interval='+str(self.h264_i_frame_period)+' drc='+str(self.drc)+ \
								' image-effect=denoise shutter-speed='+str(self.shutter)+' iso='+str(self.iso)+ \
								' brightness='+str(self.brightness)+' contrast='+str(self.contrast)+' saturation='+str(self.saturation)+ \
								' sharpness='+str(self.sharpness)+' awb-mode='+str(self.white_balance)+ ' rotation='+str(self.rotation) + \
								' hflip='+str(self.horizontal_mirroring)+' vflip='+str(self.vertical_mirroring) + ' video-stabilisation='+str(self.video_stabilisation)
								
			if self.white_balance == 0:
				log.info("Using custom white balance settings")
				launch_str = launch_str + 'awb-gain-red='+self.gain_red
				launch_str = launch_str + 'awb-gain-green='+self.gain_green
				launch_str = launch_str + 'awb-gain-blue='+self.gain_blue
			
			# Completing the pipe
			# By defining the video/x-264 or image/jpeg, the rpicamsrc module learns what output format to generate
			if self.codec == 0:
				launch_str = launch_str + ' ! video/x-h264, framerate='+str(self.fps)+'/1, width='+str(self.width)+', height='+str(self.height)+' ! h264parse ! rtph264pay name=pay0 pt=96 )'
			elif self.codec == 1:
				launch_str = launch_str + ' ! image/jpeg, framerate='+str(self.fps)+'/1, width='+str(self.width)+', height='+str(self.height)+' ! jpegparse ! rtpjpegpay name=pay0 pt=96 )'
			else:
				log.error("Illegal codec")

		elif self.type == "testsrc":
			# Generate a test image, encoded to H264 using libx264 or MJPEG. On a Pi this could have passed the raw image to the GPU (eg omxh264enc)

			# Ignore most of the parameters
			log.info("Test camera ignored most of the parameters")
			selected_pattern = self.pattern
			source_path = self.device if self.device and self.device != "auto" else None
			if selected_pattern == "file" and not source_path:
				log.warning("File pattern selected but no file provided, using color bars instead")
				selected_pattern = "colorbars"
			pattern = selected_pattern
			if pattern == "colorbars":
				pattern = "smpte"

			if selected_pattern == "file":
				launch_str = "( filesrc location=\"" + source_path + "\" ! decodebin ! videoconvert ! videoscale ! video/x-raw,width="+str(self.width)+",height="+str(self.height)+",framerate="+str(self.fps)+"/1 "
			elif selected_pattern == "image":
				image_path = source_path if source_path else "sample_image.jpg"
				launch_str = "( videotestsrc pattern=black is-live=true ! video/x-raw,width="+str(self.width)+",height="+str(self.height)+",framerate="+str(self.fps)+"/1 "
				launch_str = launch_str + " ! gdkpixbufoverlay location=\"" + image_path + "\" overlay-width=" + str(self.width) + " overlay-height=" + str(self.height) + " "
			else:
				launch_str = "( videotestsrc pattern="+pattern+" is-live=true ! video/x-raw,width="+str(self.width)+",height="+str(self.height)+",framerate="+str(self.fps)+"/1 "
			launch_str = launch_str + " ! clockoverlay "

			# Completing the pipe
			if self.codec == 0:
				launch_str = launch_str + " ! x264enc tune=zerolatency ! h264parse ! rtph264pay name=pay0 pt=96 )"
			elif self.codec == 1:
				launch_str = launch_str + " ! jpegenc ! jpegparse ! rtpjpegpay name=pay0 pt=96 )"
			else:
				log.error("Illegal codec")

		elif self.type == "filesrc":
			# Generate a black test image and overlay a jpeg (scaling to fit the image). Encoded to H264 using libx264.
		        # On a Pi this could have passed the raw image to the GPU (omxh264enc)
		        # I did try the videomixer/compositor and a filesrc plus imagefreeze but the only thing I could get working real-time was gdkpixbuffer

			# Ignore most of the parameters
			log.info("Test camera ignored most of the parameters")

			launch_str = '( videotestsrc pattern=black is-live=true ! video/x-raw,width='+str(self.width)+',height='+str(self.height)+',framerate='+str(self.fps)+'/1 '
			launch_str = launch_str + ' ! gdkpixbufoverlay location="' + self.device + '" overlay-width=' + str(self.width) + ' overlay-height=' + str(self.height) + ' '
			launch_str = launch_str + ' ! clockoverlay '

			# Completing the pipe
			if self.codec == 0:
				launch_str = launch_str + ' ! queue ! x264enc tune=zerolatency ! h264parse ! rtph264pay name=pay0 pt=96 '
			elif self.codec == 1:
				launch_str = launch_str + ' ! jpegenc ! jpegparse ! rtpjpegpay name=pay0 pt=96 '
			else:
				log.error("Illegal codec")
			launch_str = launch_str + ' )'

		else: # usbcam USB Camera
			# Ignore most of the parameters
			log.info("USB camera ignored most of the parameters")
			launch_str = '( v4l2src is-live=true device='+self.device+' brightness='+str(self.brightness)+' contrast='+str(self.contrast)+' saturation='+str(self.saturation)
			launch_str = launch_str + ' ! queue ! jpegdec ! clockoverlay ! queue ! x264enc tune=zerolatency ! h264parse ! rtph264pay name=pay0 pt=96 )'

			# TODO .... allow MJPEG output codec

		log.debug(launch_str)
		cam_mutex.acquire()
		try:
			log.info("Starting service on port "+str(self.port)+" at url /"+self.name)
			self.factory.set_launch(launch_str)
			self.server.set_service(str(self.port))
			self.mounts.add_factory("/"+str(self.name), self.factory)
			self.context_id = self.server.attach(None)
			
			#mainloop.run()
			self.mainthread = Thread(target=self.mainloop.run)
			self.mainthread.daemon = True
			self.mainthread.start()
			self.running = True
		finally:
			cam_mutex.release()
		log.info("Running RTSP Server")
		
	def start(self):
		p = subprocess.Popen("ps -ax | grep rpos.js", shell=True, stdout=subprocess.PIPE)
		output = p.stdout.read().decode('utf-8')
		while self.stayAwake and "rpos" in output:
			if os.stat(self.file).st_mtime != self.configDate:
				log.info("Updating stream settings")
				self.readConfig()
				self.updateConfig()
			else:
				time.sleep(1.0)
		log.warning("Quitting service")
	
	def disconnect_all(self, a, b):
		return GstRtspServer.RTSPFilterResult.REMOVE
	
	def stop(self):
		if self.running:
			log.debug("Suspending RTSP Server")
			cam_mutex.acquire()
			try:
				self.server.client_filter(self.disconnect_all)
				time.sleep(0.3)
				self.mainloop.quit()
				self.mainthread.join()
				self.mounts.remove_factory("/h264")
				GLib.Source.remove(self.context_id)
				self.running = False
			finally:
				cam_mutex.release()
	
	def updateConfig(self):
		#TODO: Manipulate the running pipe rather than destroying and recreating it.
		self.stop()
		self.launch()

if __name__ == '__main__':
	codec = 0 		# Default to H264
	if args.mjpeg:
		codec = 1
	streamServer = StreamServer(args.type, args.device, args.file, args.rtspport, args.rtspname, \
								args.rtspresolutionwidth, args.rtspresolutionheight,\
								codec, args.pattern, args.preset, args.rtspframerate)
	streamServer.readConfig()
	streamServer.launch()
	streamServer.start()
	
