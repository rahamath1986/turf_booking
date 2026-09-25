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

# Non-root user for container security
USER node

EXPOSE 4000

CMD ["node", "dist/main"]
