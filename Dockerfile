# Node + ffmpeg + yt-dlp (binary) — untuk Render
FROM node:20-bullseye-slim

# Install python3, curl, ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      ca-certificates \
      curl \
      ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Ambil yt-dlp binary
ADD https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

# Cek versi (opsional, bisa dihapus kalau suka error)
# RUN python3 --version && yt-dlp --version

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
