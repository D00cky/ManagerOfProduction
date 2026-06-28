FROM node:22-trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
# Pin npm to match the version the committed package-lock.json was generated
# with, so `npm ci` resolves the same dependency tree the image ships with.
RUN npm install -g npm@11.6.2

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Node heap is set at runtime via NODE_OPTIONS (see docker-compose). A small
# fallback keeps non-compose runs from going unbounded.
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=node:node /app ./
RUN mkdir -p /backups && chown -R node:node /backups
USER node
EXPOSE 3000
CMD ["npm", "run", "start:vps"]
