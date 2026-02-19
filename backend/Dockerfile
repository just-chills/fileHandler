FROM node:22-slim

# better-sqlite3 needs build tools
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install && npm install --save-dev nodemon

COPY .env ./

COPY src/ ./src/
COPY .env ./

RUN mkdir -p src/uploads

EXPOSE 5000

CMD ["npm", "run", "dev"]