FROM node:22-slim

WORKDIR /app

RUN npm install -g http-server

COPY src/index.html ./
COPY src/script.js ./

EXPOSE 80

CMD ["http-server", ".", "-p", "80"]