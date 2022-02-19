#!/bin/sh

echo View with rtsp://localhost:8554/h264
/usr/bin/python ./python/gst-rtsp-launch.py --type test --device "" --rtspresolutionwidth 640 --rtspresolutionheight 480 --rtspport 8554 --rtspname h264 -v
