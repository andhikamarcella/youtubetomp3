# ---- build annie (static binary) ----
FROM golang:1.22-alpine AS annie-builder
RUN apk add --no-cache git
RUN go install github.com/iawia002/annie@latest

# ---- runtime ----
FROM node:20-alpine

# dependensi runtime
RUN apk add --no-cache ffmpeg ca-certificates && update-ca-certificates

# copy annie binary
COPY --from=annie-builder /go/bin/annie /usr/local/bin/annie

# app files
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# env optional (ADMIN_TOKEN untuk admin.js, dll)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080
CMD ["npm", "start"]
