# TaskMaster API image.
# Build:  docker compose build api      (or: docker build -t taskmaster-api .)
# Run:    docker compose up -d          (starts PostgreSQL and the API; see README)

FROM node:22-bookworm-slim

# Prisma's migration engine needs OpenSSL; ca-certificates for any outbound HTTPS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies first so this layer is cached until package*.json changes.
# The Prisma schema and config are needed here because `postinstall` runs `prisma generate`.
COPY package.json package-lock.json prisma.config.js ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Uploaded attachments live here; docker-compose mounts a volume on it so files survive restarts.
# Created before switching user so the volume starts out owned by the unprivileged `node` user.
RUN mkdir -p /app/uploads && chown node:node /app/uploads
ENV UPLOAD_DIR=/app/uploads

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 4000) + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Apply any pending migrations, then start the server. `exec` replaces the shell with Node,
# so the SIGTERM sent by `docker stop` reaches the app's graceful shutdown handler.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node src/server.js"]
