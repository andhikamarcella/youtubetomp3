# ---- build annie/lux (Go) ----
FROM golang:1.22-alpine AS annie-builder
RUN apk add --no-cache git
# lux adalah rename dari annie; kita install lux dan rename binarinya jadi "annie"
RUN go install github.com/iawia002/lux@latest && mv /go/bin/lux /go/bin/annie

# ---- runtime ----
FROM node:20-alpine
# ffmpeg buat convert ke MP3, ca-certificates biar TLS ok
RUN apk add --no-cache ffmpeg ca-certificates && update-ca-certificates

# copy annie binary
COPY --from=annie-builder /go/bin/annie /usr/local/bin/annie

# app files
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
