/**
 * Download a project version as a `.zip`.
 *
 * Used by teachers to review a submission offline, and by students to keep a
 * copy of their own game. Access is the same relational check as everywhere
 * else: the owner, a teacher who actually teaches them, or an admin.
 *
 * `?ban=<version>` selects a submitted version; without it the current working
 * copy is packaged.
 */
import { moDuAn } from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { nenDuAn, tenTepAnToan } from '@/lib/project-zip';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  const actor = await currentActor();
  if (!actor) return new Response('Chưa đăng nhập.', { status: 401 });

  let duAn;
  try {
    duAn = await moDuAn(db, actor, id);
  } catch {
    return new Response('Không có quyền.', { status: 403 });
  }

  const banRaw = new URL(req.url).searchParams.get('ban');
  const soBan = banRaw === null ? null : Number(banRaw);
  if (banRaw !== null && !Number.isInteger(soBan)) {
    return new Response('Số bản không hợp lệ.', { status: 400 });
  }

  const ban = await db.projectVersion.findFirst({
    where:
      soBan === null
        ? { projectId: id, submittedAt: null }
        : { projectId: id, version: soBan },
    orderBy: { version: 'desc' },
    select: {
      version: true,
      submittedAt: true,
      files: { select: { path: true, storageKey: true } },
    },
  });

  if (!ban) return new Response('Không tìm thấy bản này.', { status: 404 });
  if (ban.files.length === 0) {
    return new Response('Bản này chưa có tệp nào.', { status: 404 });
  }

  const { duLieu, thieu } = await nenDuAn(ban.files);

  const ten = `${tenTepAnToan(duAn.title)}-ban-${ban.version}.zip`;

  return new Response(new Uint8Array(duLieu), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(duLieu.length),
      'Content-Disposition': `attachment; filename="${ten}"`,
      'X-Content-Type-Options': 'nosniff',
      // Surfaced rather than swallowed: a teacher opening a silently incomplete
      // archive would have no way to know files were missing.
      ...(thieu.length > 0 ? { 'X-Dye-Thieu-Tep': String(thieu.length) } : {}),
      'Cache-Control': 'private, no-store',
    },
  });
}
