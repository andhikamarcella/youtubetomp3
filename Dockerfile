FROM node:20-alpine

# install deps
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates && update-ca-certificates

# install pytube (pakai opsi biar ga ketahan PEP 668)
RUN pip3 install --no-cache-dir --break-system-packages pytube

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
