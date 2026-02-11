FROM node:20-bookworm-slim AS base

FROM base AS deps
RUN apt-get update && apt-get install -y libc6 python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install deps (prefer lockfile if present)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install PostgreSQL client 17 for Supabase compatibility (fixes version mismatch)
RUN apt-get update && apt-get install -y curl ca-certificates gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt/ bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    postgresql-client-18 \
    # Needed for some python wheels if they need building
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python libraries
RUN pip3 install --no-cache-dir --break-system-packages \
    curl_cffi \
    beautifulsoup4 \
    lxml

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs

# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# IMPORTANT: Manually copy the Python bridge files as they aren't part of the standalone build
COPY --from=builder --chown=nextjs:nodejs /app/scraper_bridge.py ./
COPY --from=builder --chown=nextjs:nodejs /app/anti_detect.py ./

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
