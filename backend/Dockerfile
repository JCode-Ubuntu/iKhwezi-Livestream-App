FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++ ffmpeg

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p storage/videos storage/uploads storage/hls

EXPOSE 3001

CMD ["node", "index.js"]
