FROM node:20-alpine

# install deps
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates && update-ca-certificates

# bikin virtualenv untuk python packages
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# install PyTube ke virtualenv
RUN pip install --no-cache-dir pytube

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
