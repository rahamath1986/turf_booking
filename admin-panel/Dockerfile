# ==============================================================================
# Multi-Stage Dockerfile for Turf Booking Admin Panel (Next.js)
# NOTE: NEXT_PUBLIC_* vars are inlined at build time — pass NEXT_PUBLIC_API_URL
# as a build arg (see docker-compose.yml) pointing at the backend API.
# ==============================================================================

FROM node:20-slim AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

# ==============================================================================
# Production Runner (`next start`)
# ==============================================================================

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Non-root user for container security
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "start"]
