/**
 * Environment bootstrap for the judge worker.
 *
 * ── Why the worker loads its own env instead of trusting its launcher ────────
 * This process is started four different ways, and only one of them goes
 * through Turborepo:
 *
 *     npm run dev                     → turbo run dev → tsx watch src/index.ts
 *     npm start --workspace @dye/…    → tsx src/index.ts, no turbo
 *     pm2 start / systemd on a VPS    → node/tsx directly, no npm at all
 *     docker compose -f …prod.yml     → env injected by compose
 *
 * Fixing only the Turborepo path would leave the two that matter most on a VPS
 * still broken, and they are the ones that fail at three in the morning. So the
 * worker bootstraps itself: wherever it is launched from, it finds the root
 * `.env` and reads it.
 *
 * The load is a no-op when the variables are already set, so the Docker path —
 * where compose injects them properly — is unaffected.
 *
 * ── Why this is a separate module ────────────────────────────────────────────
 * It must run BEFORE anything reads `process.env`, and two modules do that at
 * import time: `config.ts` computes its limits from env at module scope, and
 * `@prisma/client` resolves the datasource URL when a client is constructed.
 * ES modules evaluate dependencies in import order, so `import './env'` as the
 * FIRST import of an entry point is what guarantees the ordering. A bare
 * `napEnv()` call inside `index.ts` would run after every import had already
 * been evaluated, which is exactly too late.
 */
import { doiBienMoiTruong, napEnv } from '../../../scripts/moi-truong.mjs';

const ketQua = napEnv();

/*
 * Fail here, with a message that names the file that was not found.
 *
 * Prisma's own error is "Environment variable not found: DATABASE_URL" pointing
 * at `schema.prisma:17`. That is accurate and useless: it describes the schema
 * line that referenced the variable, not the fact that a `.env` sits one
 * directory above the process and was never read. Nobody debugging a VPS at
 * night should have to work that out from a schema line number.
 *
 * REDIS_URL is deliberately NOT required. `config.ts` has a working default for
 * it, and refusing to start over a variable with a default would be a
 * regression for anyone running a stock local Redis.
 */
doiBienMoiTruong(['DATABASE_URL'], ketQua);

export const MOI_TRUONG = ketQua;
