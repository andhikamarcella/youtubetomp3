FROM node:20-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3-pip \
 && pip3 install --no-cache-dir yt-dlp \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci || npm i
ENV PORT=8080
RUN mkdir -p public/jobs
CMD ["node","index.js"]
