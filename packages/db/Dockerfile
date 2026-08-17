# One-shot migration + seed container.
#
# Used by the `db-migrate` service in docker-compose.yml so that a plain
# `docker compose up` leaves the database fully populated with the real
# 3-course / 90-lesson curriculum.
#
# Build context is the REPO ROOT (see docker-compose.yml) because the workspace
# lockfile lives there.

FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL. ca-certificates keeps npm happy over TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what the db workspace needs, so the layer cache survives edits to
# apps/* and the other packages.
COPY package.json package-lock.json ./
COPY packages/db/package.json ./packages/db/package.json

# `npm ci` needs every workspace manifest referenced by the lockfile to exist.
# The db workspace is the only one with dependencies at this phase; as more
# workspaces land, add their package.json copies above this line.
RUN npm ci --workspace @dye/db --include-workspace-root --no-audit --no-fund

COPY packages/db ./packages/db

WORKDIR /app/packages/db

RUN npx prisma generate

# Fail loudly rather than silently skipping the seed.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]
