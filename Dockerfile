# Node + ffmpeg + yt-dlp (binary) — compatible di Render
FROM node:20-bookworm-slim

# Install dependencies yang dibutuhkan yt-dlp binary
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      ca-certificates \
      curl \
      ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Ambil yt-dlp binary release (tanpa pip)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    python3 --version && yt-dlp --version

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm","start"]
