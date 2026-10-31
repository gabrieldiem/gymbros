################################
# Stage 1: Build the React app
################################
FROM node:22-alpine AS builder

WORKDIR /app

# Copy only dependency manifests first (to leverage Docker build cache for faster builds)
COPY package.json package-lock.json /app/
RUN npm ci --no-audit --no-fund

# Type-check and build to /app/dist
COPY . .
RUN npm run build

################################
# Stage 2: Serve with nginx
################################
FROM nginx:1.29-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD wget -q --spider http://127.0.0.1/ || exit 1
