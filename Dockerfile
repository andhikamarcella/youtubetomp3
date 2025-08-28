FROM node:20-slim

# 1) Install ffmpeg + tools dasar
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    python3 \
    python3-pip \
    wget; \
  rm -rf /var/lib/apt/lists/*

# 2) Install yt-dlp dengan metode yang lebih reliable
RUN set -eux; \
  # Install via pip untuk mendapatkan versi terbaru
  pip3 install --no-cache-dir yt-dlp; \
  # Buat symlink jika diperlukan
  ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp; \
  # Verifikasi instalasi
  yt-dlp --version

# 3) Debug: print versi di log build
RUN which ffmpeg && ffmpeg -version | head -n 1 && which yt-dlp && yt-dlp --version

# 4) App
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# 5) Environment variables
ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3000
CMD ["npm","start"]