# DYE LMS — web application image.
#
# Multi-stage so the runtime carries no build toolchain, no dev dependencies and
# no source. Only the traced standalone server, the static assets, and the
# generated Prisma client.

# ── Stage 1: dependencies ────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Copied on their own so this layer is only rebuilt when a manifest changes,
# not on every source edit.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/judge-worker/package.json apps/judge-worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/

# --ignore-scripts: nothing in this tree needs a postinstall, and running
# arbitrary install hooks in an image build is a supply-chain surface.
RUN npm ci --ignore-scripts

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The client must exist before `next build` typechecks anything that imports it.
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# A build-time placeholder so Auth.js can be imported during the build.
#
# ARG rather than ENV on purpose: an ARG is visible to RUN in this stage but is
# not written into the image config, so the placeholder cannot survive into a
# running container and masquerade as a real secret. The actual secret arrives
# as a runtime environment variable.
ARG AUTH_SECRET=build-time-placeholder-not-used-at-runtime
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Opts this build into `output: 'standalone'`. Off by default so that a local
# `next start` — which the Playwright suite depends on — keeps working.
ENV BUILD_STANDALONE=1

RUN npm run build --workspace @dye/web

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# The standalone output already contains only the modules actually reached.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# No `public/` copy: apps/web has no public directory, and COPY of a missing
# path fails the build. Add one here if that ever changes.
#
# Prisma's query engine and the argon2 native module are NOT copied either —
# `output: standalone` already traces both into standalone/node_modules, and
# because `prisma generate` runs inside the Alpine builder above, the engine
# there is the linux-musl build this image needs.

# Uploaded project files live on a volume; the directory must exist and be
# writable by the runtime user before the volume is mounted over it.
RUN mkdir -p /data/uploads/projects && chown -R nextjs:nodejs /data

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
