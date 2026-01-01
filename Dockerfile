# Dockerfile submitted by hardysim

RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    curl
    
WORKDIR /data

RUN npm install -g n \
    && n install 24

RUN git clone https://github.com/BreeeZe/rpos.git \
    && cd rpos \
    && rm package-lock.json \
    && npm install
    
WORKDIR /data/rpos 

COPY rposConfig.json /data/rpos/

RUN npx gulp

CMD ["node", "./rpos.js"]
