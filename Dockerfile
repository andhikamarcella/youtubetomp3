FROM brainicism/bgutil-ytdlp-pot-provider:1.3.1-node AS bgutil-provider

FROM node:20-slim

# Install ffmpeg, Python, current yt-dlp extras, Deno, and the matching PO-token plugin.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg curl unzip ca-certificates python3 python3-pip \
  && curl -fsSL https://deno.land/install.sh | sh \
  && install -m 0755 /root/.deno/bin/deno /usr/local/bin/deno \
  && python3 -m pip install --no-cache-dir --break-system-packages --upgrade \
       "yt-dlp[default,curl-cffi]" \
       "bgutil-ytdlp-pot-provider==1.3.1" \
       pytube \
  && deno --version \
  && python3 -m yt_dlp --version \
  && mv /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp-real \
  && rm -rf /var/lib/apt/lists/*

COPY --from=bgutil-provider /app /opt/bgutil-provider
RUN test -f /opt/bgutil-provider/build/main.js

# Public videos use the same no-cookie flow as the working CLI first. The
# BgUtils provider supplies fresh per-video PO tokens for Render's server IP.
ENV YTDLP_JS_RUNTIME=deno
ENV YTDLP_YOUTUBE_PLAYER_CLIENTS=mweb
ENV YTDLP_FETCH_POT=always
ENV YTDLP_POT_PROVIDER_URL=http://127.0.0.1:4416
ENV YTDLP_AUTO_INJECT_COOKIES=false
ENV YTDLP_IMPERSONATE=chrome
ENV YTDLP_SLEEP_REQUESTS=0.75
ENV YTDLP_REAL_PATH=/usr/local/bin/yt-dlp-real

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN printf '#!/bin/sh\nexec node /app/scripts/yt-dlp-cli-bridge-wrapper.mjs "$@"\n' > /usr/local/bin/yt-dlp \
  && chmod 0755 /usr/local/bin/yt-dlp \
  && node --check /app/scripts/yt-dlp-cli-bridge-wrapper.mjs \
  && node --check /app/cli-bridge/server.mjs
EXPOSE 3000

# Keep the PO-token provider private inside the same container, then start the app.
CMD ["sh", "-c", "node /opt/bgutil-provider/build/main.js --port 4416 & exec npm start"]
