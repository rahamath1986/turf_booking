# ==============================================================================
# Multi-Stage Dockerfile for Turf Booking Backend (NestJS + Prisma)
# ==============================================================================

FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package manifests and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies required for compilation)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source files and TypeScript configuration
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

# Compile NestJS build
RUN npm run build

# Remove development dependencies for minimal production footprint
RUN npm prune --omit=dev

# ==============================================================================
# Production Runner
# ==============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# Install OpenSSL for Prisma database engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

# Copy necessary production artifacts from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Install the Prisma CLI (pinned to the repo's devDependency version) so the
# container can apply pending migrations on boot. `npm prune` in the builder
# stage removes devDependencies, hence this explicit install.
RUN PRISMA_VERSION=$(node -p "require('./package.json').devDependencies.prisma") \
  && npm install --no-save --no-audit --no-fund "prisma@$PRISMA_VERSION" \
  && npm cache clean --force

# Non-root user for container security
USER node

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Apply pending Prisma migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
