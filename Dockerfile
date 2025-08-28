FROM node:20-slim

# 1) Python + venv + ffmpeg
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates curl; \
  rm -rf /var/lib/apt/lists/*

# 2) Buat virtualenv khusus yt-dlp dan install di situ (hindari PEP 668)
RUN set -eux; \
  python3 -m venv /opt/ytvenv; \
  /opt/ytvenv/bin/pip install --upgrade pip; \
  /opt/ytvenv/bin/pip install --no-cache-dir yt-dlp

# 3) Tunjukkan versi (buat verifikasi di build log)
RUN /opt/ytvenv/bin/python -m yt_dlp --version && ffmpeg -version | head -n 1

# 4) App
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Python dari venv kita jadikan default untuk app (dipakai index.js)
ENV YT_PY=/opt/ytvenv/bin/python
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm","start"]
