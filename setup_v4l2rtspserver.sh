git clone https://github.com/mpromonet/v4l2rtspserver
sudo apt install -y liblivemedia-dev liblog4cpp5-dev cmake libasound2-dev
cd v4l2rtspserver
cmake . && make
sudo make install
