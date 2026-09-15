import { authorize } from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { khoDuAn } from '@/lib/project-storage';

/**
 * Serve the .hex a student handed in, to someone allowed to read the submission.
 *
 * ── Who ──────────────────────────────────────────────────────────────────────
 * `authorize(submission: read)` — the student who owns it, a teacher who
 * teaches them, or an admin. The same relational rule as every other read of
 * a submission; a guessed id from outside that relationship is a 403.
 *
 * ── What ─────────────────────────────────────────────────────────────────────
 * Exactly the bytes stored under the submission's content-addressed key. The
 * filename in the header is rebuilt from the student's name and attempt so a
 * teacher with ten downloads in a folder can tell them apart; the original
 * name lives in the submission's `code` note if they need it.
 *
 * `Content-Disposition: attachment`: a .hex must never render inline. A
 * browser asked to display one shows a wall of hex to a teacher, or worse,
 * tries to be helpful with it.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  const actor = await currentActor();
  if (!actor) return new Response('Chưa đăng nhập.', { status: 401 });

  try {
    await authorize(db, actor, { resource: 'submission', action: 'read', submissionId: id });
  } catch {
    return new Response('Không có quyền.', { status: 403 });
  }

  const sub = await db.submission.findUnique({
    where: { id },
    select: {
      hexKey: true,
      attemptNo: true,
      student: { select: { username: true } },
    },
  });
  if (!sub?.hexKey) return new Response('Bài nộp này không có tệp .hex.', { status: 404 });

  const bytes = await khoDuAn.doc(sub.hexKey);
  if (!bytes) return new Response('Tệp không còn trong kho.', { status: 404 });

  const ten = `${sub.student.username}-lan-${sub.attemptNo}.hex`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${ten}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store',
    },
  });
}
