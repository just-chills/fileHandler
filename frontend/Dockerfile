FROM node:22-slim AS builder

WORKDIR /app

COPY src/ ./
COPY public/* ./

# Stage 2: Nginx
FROM nginx:alpine

# ลบ config เดิม
RUN rm -rf /etc/nginx/conf.d/*

COPY --from=builder /app /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]