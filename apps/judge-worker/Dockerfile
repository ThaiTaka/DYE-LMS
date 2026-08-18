# The judge worker.
#
# ── A note on what this container is allowed to do ───────────────────────────
# The worker needs to talk to a Docker daemon in order to start sandbox
# containers. When it runs inside Docker itself, that means mounting the host's
# docker.sock — which grants effective root on the host to whatever holds it.
#
# That is acceptable for THIS process and would not be for the sandbox: the
# worker executes only code from this repository, while the sandbox executes code
# written by students, and the sandbox never sees the socket (asserted by a test
# in src/sandbox.test.ts).
#
# For production, prefer running the worker directly on a dedicated judge host,
# or against a rootless/remote daemon over DOCKER_HOST. The compose service is
# behind a profile so it is an explicit choice, never a default.
FROM node:24-alpine

# The Docker CLI: the worker shells out to `docker run` with an explicit argv
# array, so the client binary has to exist in this image.
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY apps/judge-worker/package.json apps/judge-worker/

RUN npm ci --omit=dev --ignore-scripts

COPY packages/ packages/
COPY apps/judge-worker/ apps/judge-worker/

RUN npx prisma generate --schema packages/db/prisma/schema.prisma

# Not root. The socket mount is privilege enough on its own.
USER node

CMD ["npx", "tsx", "apps/judge-worker/src/index.ts"]
