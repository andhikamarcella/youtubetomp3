FROM node:20-slim

# 1) ffmpeg + tools dasar
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# 2) yt-dlp binary resmi
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
     -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# (opsional) bukti saat build — bantu debug di log
RUN which ffmpeg && ffmpeg -version | head -n 1 && which yt-dlp && yt-dlp --version

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
