FROM node:20-slim
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends ffmpeg ca-certificates curl; \
  rm -rf /var/lib/apt/lists/*
RUN set -eux; \
  apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends yt-dlp || true; \
  if ! command -v yt-dlp >/dev/null; then \
    echo "Fallback to binary yt-dlp"; \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; \
    chmod a+rx /usr/local/bin/yt-dlp; \
  fi; \
  rm -rf /var/lib/apt/lists/*
RUN which ffmpeg && ffmpeg -version | head -n 1 && which yt-dlp && yt-dlp --version
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
