-- Scaffolding and multiple correct answers for code problems.
--
-- `templateCode`     — the read-only frame around a Python exercise (function
--                      signatures, `# TODO` gaps, I/O boilerplate). Empty means
--                      the editor behaves exactly as before.
-- `acceptedAnswers`  — JSON array of every output that counts as correct for
--                      answer-key problems. `[]` means grading falls through to
--                      the test cases exactly as before.
--
-- Both default to "off", so every existing problem keeps its current
-- behaviour. Additive; no row loses data.
ALTER TABLE "Problem" ADD COLUMN "templateCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Problem" ADD COLUMN "acceptedAnswers" JSONB NOT NULL DEFAULT '[]';
