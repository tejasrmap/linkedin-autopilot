# ==============================================================
# LINKEDIN AUTOPILOT - PRODUCTION MULTI-STAGE DOCKERFILE
# BY GT INNOX LLP
# ==============================================================

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 1. Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Build Next.js application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# 3. Production runner
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]

