/**
 * Serving one uploaded project file.
 *
 * ── Why uploads are not in `public/` ─────────────────────────────────────────
 * Anything under `public/` is served by the framework with no authorization at
 * all, at a guessable URL. A child's work would be readable by anyone who tried
 * the path. Every byte therefore comes through this handler, which resolves the
 * viewer first and the file second.
 *
 * ── How a stored file is prevented from becoming code ────────────────────────
 * The response is deliberately inert:
 *
 *   • `X-Content-Type-Options: nosniff` — the browser may not upgrade a `.py`
 *     or a `.json` into something it decides to execute.
 *   • Text types are forced to `text/plain`. A student's file is shown, never
 *     interpreted; serving one as `text/html` would make an upload field into
 *     stored XSS against their own teacher.
 *   • `Content-Disposition` names the file for saving and nothing more.
 *   • A restrictive CSP with `sandbox`, so even if a type is somehow honoured
 *     the document has no script, no origin, and no ambient authority.
 *
 * Nothing here — or anywhere else in the app — ever executes an uploaded byte on
 * the host. Student Python runs in the Phase 8 container or not at all.
 */
import { moDuAn } from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { khoDuAn } from '@/lib/project-storage';

/** Types safe to hand a browser inline. Everything else downloads. */
const KIEU_XEM_DUOC = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/bmp',
  'audio/wav',
  'audio/ogg',
  'audio/mpeg',
]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; fileId: string }> },
): Promise<Response> {
  const { id, fileId } = await ctx.params;

  const actor = await currentActor();
  if (!actor) return new Response('Chưa đăng nhập.', { status: 401 });

  try {
    // Relational check: owner, their teacher, or an admin.
    await moDuAn(db, actor, id);
  } catch {
    return new Response('Không có quyền.', { status: 403 });
  }

  const tep = await db.projectFile.findFirst({
    // Scoped to this project, so a file id from elsewhere cannot be fetched by
    // anyone who happens to be able to open some project.
    where: { id: fileId, version: { projectId: id } },
    select: { path: true, storageKey: true, sniffedMime: true, sizeBytes: true },
  });
  if (!tep) return new Response('Không tìm thấy tệp.', { status: 404 });

  const duLieu = await khoDuAn.doc(tep.storageKey);
  if (!duLieu) return new Response('Không tìm thấy nội dung tệp.', { status: 404 });

  const xemDuoc = KIEU_XEM_DUOC.has(tep.sniffedMime);
  // Text is served as text/plain regardless of what it claims to be: a .py or
  // .json shown as anything else is a script waiting for a browser to run it.
  const kieu = xemDuoc ? tep.sniffedMime : 'text/plain; charset=utf-8';
  const ten = tep.path.split('/').pop() ?? 'tep';

  return new Response(new Uint8Array(duLieu), {
    status: 200,
    headers: {
      'Content-Type': kieu,
      'Content-Length': String(tep.sizeBytes),
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${xemDuoc ? 'inline' : 'attachment'}; filename="${encodeURIComponent(ten)}"`,
      // Belt and braces: no scripts, no origin, nothing ambient.
      'Content-Security-Policy': "default-src 'none'; sandbox; style-src 'unsafe-inline'",
      // A child's work is not for shared caches.
      'Cache-Control': 'private, max-age=60',
    },
  });
}
