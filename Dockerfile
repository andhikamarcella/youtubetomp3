# Gunakan base image node
FROM node:20-slim

# Install ffmpeg dan curl untuk ambil yt-dlp
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
 && update-ca-certificates \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Buat folder kerja
WORKDIR /app

# Copy package.json dulu untuk cache dependency
COPY package*.json ./

# Install dependency node
RUN npm ci || npm i

# Copy semua file project
COPY . .

# Set environment PORT (Render akan override ini)
ENV PORT=8080

# Buat folder untuk hasil konversi
RUN mkdir -p public/jobs

# Start server
CMD ["node", "index.js"]
