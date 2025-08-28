FROM node:20-slim

# Install ffmpeg + curl, ambil yt-dlp binary (tanpa pip)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
 && update-ca-certificates \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# lebih cepat: install deps dulu baru copy source
COPY package*.json ./
RUN npm ci || npm i

COPY . .

ENV PORT=8080
RUN mkdir -p public/jobs

CMD ["node","index.js"]
