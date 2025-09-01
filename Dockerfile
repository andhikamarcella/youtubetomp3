FROM node:20-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg curl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
