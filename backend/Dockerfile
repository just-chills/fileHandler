FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install && npm install --save-dev nodemon

COPY src/ ./src/

RUN mkdir -p src/uploads

EXPOSE 5000

CMD ["npm", "run", "dev"]