FROM node:20-slim

# Install ffmpeg, Python, the latest yt-dlp extras, and Deno for YouTube's EJS challenges.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl unzip ca-certificates python3 python3-pip \
  && curl -fsSL https://deno.land/install.sh | sh \
  && install -m 0755 /root/.deno/bin/deno /usr/local/bin/deno \
  && python3 -m pip install --no-cache-dir --break-system-packages --upgrade "yt-dlp[default,curl-cffi]" pytube \
  && deno --version \
  && python3 -m yt_dlp --version \
  && rm -rf /var/lib/apt/lists/*

ENV YTDLP_JS_RUNTIME=deno
ENV YTDLP_IMPERSONATE=chrome
ENV YTDLP_SLEEP_REQUESTS=0.75

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 3000
CMD ["npm", "start"]
