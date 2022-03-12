#!/bin/sh

echo View with rtsp://localhost:8554/h264
/usr/bin/python ./python/gst-rtsp-launch.py --type filesrc --device "testimage.jpg" --rtspresolutionwidth 900 --rtspresolutionheight 800 --rtspport 8554 --rtspname h264 -v
