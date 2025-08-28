FROM node:20-slim

# 1) Install ffmpeg + tools dasar
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends ffmpeg ca-certificates curl; \
  rm -rf /var/lib/apt/lists/*

# 2) Install yt-dlp
#    - Coba lewat APT
#    - Kalau paket tidak ada, fallback ke binary GitHub
RUN set -eux; \
  apt-get update && apt-get install -y --no-install-recommends yt-dlp || true; \
  if ! command -v yt-dlp >/dev/null; then \
    echo "Fallback: unduh binary yt-dlp dari GitHub..."; \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp; \
    chmod a+rx /usr/local/bin/yt-dlp; \
  fi; \
  rm -rf /var/lib/apt/lists/*

# 3) Debug: print versi di log build
RUN which ffmpeg && ffmpeg -version | head -n 1 && which yt-dlp && yt-dlp --version

# 4) App
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm","start"]
