# Base image
FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive

# System deps: ffmpeg + python + pip
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      ca-certificates \
 && pip3 install --no-cache-dir --break-system-packages yt-dlp \
 && rm -rf /var/lib/apt/lists/*

# App
WORKDIR /app

# NPM deps dulu (biar cache bagus)
COPY package*.json ./
RUN npm ci || npm i

# Source
COPY . .

# Folder output
RUN mkdir -p public/jobs

# Render inject PORT; jangan hardcode 3000
ENV PORT=10000
EXPOSE 10000

CMD ["node","index.js"]
