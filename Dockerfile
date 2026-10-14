# ==============================================================================
# Stage 1: Build the Vite React Frontend Bundle
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies without triggering husky prepare hook in container
RUN npm ci --ignore-scripts

# Copy application source and build configurations
COPY . .

# Build production bundle into /app/dist
RUN npm run build

# ==============================================================================
# Stage 2: Serve statically via lightweight Nginx Alpine
# ==============================================================================
FROM nginx:alpine

# Remove default nginx server configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy production nginx configuration with API reverse proxy & SPA routing
COPY nginx.conf /etc/nginx/conf.d/

# Copy compiled web assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
