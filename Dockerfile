FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app ./
# Persistent volumes are owned by the app user so start:vps can write the SQLite DB/backups.
RUN mkdir -p /data /backups && chown -R node:node /data /backups
USER node
EXPOSE 3000
CMD ["npm", "run", "start:vps"]
