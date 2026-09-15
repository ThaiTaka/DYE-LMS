import { GIOI_HAN_HEX_BYTE } from '@dye/core';

import { currentActor } from '@/auth';
import { LOI_HEX_CHU, nhanTepHex } from '@/lib/nop-hex';

import type { KetQuaNop } from '@/app/bai-hoc/[slug]/code-actions';

/**
 * Receive a .hex a student is handing in for a Micro:bit block.
 *
 * ── Why a route handler and not a server action ──────────────────────────────
 * Server actions cap the request body at 1 MB (`serverActions.bodySizeLimit`);
 * a universal micro:bit .hex is ~1.8 MB. The old action never ran for a real
 * file — Next.js refused the body before the code was reached, the client's
 * promise rejected, and the student was told to check their network. A route
 * handler reads the body itself and has no such cap; the only limit left is the
 * reverse proxy's `client_max_body_size` (25 MB in the deployment guide) and
 * `GIOI_HAN_HEX_BYTE` below.
 *
 * ── Who ──────────────────────────────────────────────────────────────────────
 * A signed-in STUDENT, and only for a block they may open: `nhanTepHex` goes
 * through `nopBaiMicrobitHex`, which resolves lesson access inside @dye/core
 * exactly as the server actions do. The endpoint being reachable is not the
 * permission.
 *
 * ── Same-origin only ─────────────────────────────────────────────────────────
 * Server actions check `Origin` against `Host` for free; a route handler has
 * to do it by hand. The session cookie is SameSite=Lax so a cross-site form
 * would not carry it anyway, but a POST that writes a submission row should
 * not rest on a cookie attribute alone. Compared against `x-forwarded-host`
 * first, which is what the proxy and the Cloudflare tunnel set — the app must
 * never hardcode or infer its own origin (see middleware.ts).
 *
 * ── The answer is always JSON, always a `KetQuaNop` ──────────────────────────
 * The client shows `thongDiep` whatever the status; the status only says which
 * kind of answer it is (200 received, 4xx refused with a reason, 500 our
 * fault). A body the client cannot parse is what it reports as a network
 * problem, so this handler never answers with anything else.
 */

/** Multipart framing on top of the file itself. Generous; the real cap is inside. */
const DU_PHONG_MULTIPART_BYTE = 64 * 1024;

function cungNguon(req: Request): boolean {
  const origin = req.headers.get('origin');
  // No Origin header: not a cross-site browser request (fetch always sends
  // one for POST). The session cookie is still required below.
  if (!origin) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function traLoi(kq: KetQuaNop, status: number): Response {
  return Response.json(kq, { status, headers: { 'Cache-Control': 'no-store' } });
}

function tuChoi(thongDiep: string, status: number): Response {
  return traLoi({ trangThai: 'tu-choi', submissionId: null, attemptNo: null, thongDiep }, status);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ blockId: string }> },
): Promise<Response> {
  if (!cungNguon(req)) return tuChoi('Yêu cầu không hợp lệ.', 403);

  const actor = await currentActor();
  if (!actor) return tuChoi('Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.', 401);
  if (actor.role !== 'STUDENT') return tuChoi('Chỉ học sinh mới nộp bài được.', 403);

  const { blockId } = await ctx.params;
  if (!blockId) return tuChoi('Không rõ bài nào để nộp.', 400);

  // Refuse an oversized body BEFORE buffering it: a client that lies about
  // Content-Length still meets GIOI_HAN_HEX_BYTE on the parsed file below.
  const doDai = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(doDai) && doDai > GIOI_HAN_HEX_BYTE + DU_PHONG_MULTIPART_BYTE) {
    return tuChoi(LOI_HEX_CHU['qua-lon'], 413);
  }

  let tep: FormDataEntryValue | null;
  try {
    tep = (await req.formData()).get('tep');
  } catch {
    return tuChoi('Không đọc được tệp gửi lên. Em chọn lại tệp rồi nộp nhé.', 400);
  }
  // A form entry is a File or a string; `instanceof File` is deliberately not
  // used, because the File that `formData()` produces and the global `File`
  // need not be the same constructor.
  if (tep === null || typeof tep === 'string') return tuChoi('Em chưa chọn tệp .hex nào.', 400);

  const kq = await nhanTepHex(actor.id, blockId, tep);

  const status =
    kq.trangThai === 'da-nhan'
      ? 200
      : kq.trangThai === 'loi'
        ? 500
        : kq.thongDiep === LOI_HEX_CHU['qua-lon']
          ? 413
          : 422;

  return traLoi(kq, status);
}
