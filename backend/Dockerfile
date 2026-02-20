FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src/ ./src/

RUN mkdir -p src/uploads

EXPOSE 5000

CMD ["npm", "start"]