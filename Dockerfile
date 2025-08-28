# Gunakan Node.js image
FROM node:20-slim

# Install dependencies untuk ffmpeg + yt-dlp
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip \
    && pip3 install --no-cache-dir yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Set working dir
WORKDIR /app

# Copy file backend
COPY server ./server
WORKDIR /app/server

# Install deps nodejs
RUN npm ci || npm i

# Buat folder untuk hasil download
RUN mkdir -p public/jobs

# Port untuk Render (wajib dari env $PORT)
ENV PORT=10000
EXPOSE 10000

# Start backend
CMD ["node", "index.js"]
