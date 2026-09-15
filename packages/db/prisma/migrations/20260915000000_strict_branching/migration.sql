-- Per-course tier presentation: STRICT (only your track, advanced blocks after
-- the core ones) or INTERLEAVED (the original everything-visible design).
--
-- Defaults to STRICT for every existing course. Additive; no row loses data.
CREATE TYPE "Branching" AS ENUM ('STRICT', 'INTERLEAVED');
ALTER TABLE "Course" ADD COLUMN "branching" "Branching" NOT NULL DEFAULT 'STRICT';
