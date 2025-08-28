FROM node:20-slim

# Python + pip + ffmpeg
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates curl; \
  rm -rf /var/lib/apt/lists/*

# yt-dlp sebagai modul Python
RUN pip3 install --no-cache-dir yt-dlp

# (opsional) bukti saat build
RUN python3 -m yt_dlp --version && ffmpeg -version | head -n 1

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
