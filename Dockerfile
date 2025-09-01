FROM node:20-slim

# Install ffmpeg, Python, yt-dlp, and PyTube
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates python3 python3-pip \
  && python3 -m pip install --no-cache-dir --break-system-packages yt-dlp pytube \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
