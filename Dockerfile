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
  && rm -rf /var/lib/apt/lists/*

COPY --from=bgutil-provider /app /opt/bgutil-provider
RUN test -f /opt/bgutil-provider/build/main.js

# The first metadata and download attempts are transformed by the preload into
# true vanilla, cookie-free yt-dlp calls. Enhanced Deno/client/PO-token settings
# are kept for later retries only.
ENV YTDLP_JS_RUNTIME=deno
ENV YTDLP_YOUTUBE_PLAYER_CLIENTS=mweb
ENV YTDLP_YOUTUBE_CLIENT_POOL=mweb,web,web_safari,web_embedded,tv,ios,android_vr,default
ENV YTDLP_FETCH_POT=always
ENV YTDLP_POT_PROVIDER_URL=http://127.0.0.1:4416
ENV YTDLP_AUTO_INJECT_COOKIES=false
ENV YTDLP_VANILLA_FIRST=true
ENV YTDLP_IMPERSONATE=chrome
ENV YTDLP_SLEEP_REQUESTS=0.75

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN node --check /app/src/lib/ytDlpCookiesPreload.js
EXPOSE 3000

# Keep the PO-token provider private inside the same container, then start the app.
CMD ["sh", "-c", "node /opt/bgutil-provider/build/main.js --port 4416 & exec npm start"]
