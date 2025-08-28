FROM node:20-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install yt-dlp ke /usr/local/bin/yt-dlp
RUN pip3 install --no-cache-dir yt-dlp

RUN which ffmpeg && ffmpeg -version | head -n 1 && which yt-dlp && yt-dlp --version

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
