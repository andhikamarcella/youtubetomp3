# ---- runtime: Node + Python + ffmpeg ----
FROM node:20-alpine

# system deps
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates && update-ca-certificates \
 && pip3 install --no-cache-dir pytube

# app files
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
