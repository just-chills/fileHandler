FROM node:22-slim

WORKDIR /app

RUN npm install -g http-server

COPY index.html ./
COPY style.css ./
COPY script.js ./

EXPOSE 80

CMD ["http-server", ".", "-p", "80"]