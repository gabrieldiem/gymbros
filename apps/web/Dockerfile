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
FROM nginx:1.30-alpine AS runner

# Targeted fixes the current nginx:1.30-alpine base doesn't ship yet (Trivy, 2026-10-31):
# brotli-libs CVE-2026-111497 (CRITICAL, fixed 1.2.1-r0), curl/libcurl (HIGH, fixed 8.23.0-r0).
# Only these packages are upgraded; drop this line once the base image includes the fixes.
RUN apk add --no-cache --upgrade brotli-libs curl libcurl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --retries=5 CMD wget -q --spider http://127.0.0.1/ || exit 1
