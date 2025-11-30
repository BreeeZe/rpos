#!/bin/sh
echo $@

# Ubuntu 21 installs Python3 by default and appears to have dropped the Python 2 'Gi' package that
# is required for Gstreamer GObject Introspection

FILE=/usr/bin/python3
if test -f "$FILE"; then
    echo "Found /usr/bin/python3"
    exec /usr/bin/python3 ./python/gst-rtsp-launch.py $@ -v
else
    echo "using /usr/bin/python"
    exec /usr/bin/python ./python/gst-rtsp-launch.py $@ -v
fi

