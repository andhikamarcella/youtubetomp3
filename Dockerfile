# ---- Base image Node.js
FROM node:20-slim

# ---- System deps: ffmpeg & yt-dlp
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip \
    && pip3 install --no-cache-dir yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# ---- App setup
WORKDIR /app

# Salin hanya package files dulu (biar cache npm bagus)
COPY package*.json ./
RUN npm ci || npm i

# Salin sisa source (index.js, dll)
COPY . .

# Folder untuk hasil unduhan
RUN mkdir -p public/jobs

# Render akan set $PORT sendiri, JANGAN hardcode
ENV PORT=10000
EXPOSE 10000

# Start server
CMD ["node", "index.js"]
