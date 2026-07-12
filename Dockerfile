FROM node:20-slim

# Install ffmpeg, Python, yt-dlp, PyTube, and Deno for yt-dlp JavaScript challenges.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl unzip ca-certificates python3 python3-pip \
  && curl -fsSL https://deno.land/install.sh | sh \
  && install -m 0755 /root/.deno/bin/deno /usr/local/bin/deno \
  && python3 -m pip install --no-cache-dir --break-system-packages "yt-dlp[default]" pytube \
  && rm -rf /var/lib/apt/lists/*

ENV YTDLP_JS_RUNTIME=deno

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 3000
CMD ["npm", "start"]