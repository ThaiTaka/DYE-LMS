import 'server-only';

/**
 * Per-user cooldowns for the buttons a child can hammer.
 *
 * ── What this is for ─────────────────────────────────────────────────────────
 * A class of thirty pressing "Nộp bài" at the bell is the load this app is
 * sized for. Thirty students each pressing it eight times in a second is not —
 * and a held Enter key, a double-click, or a stale tab retrying does exactly
 * that. Every hand-in re-resolves lesson access, counts attempts and writes a
 * snapshot, so the spam lands on Postgres as a burst of writes for nothing.
 *
 * It also closes a real race. The one-attempt rule (`kiemTraConLuot`) is a
 * count followed by an insert; two requests arriving together can both count
 * zero and both insert. The check-and-set below is synchronous, so in one
 * process the second request is refused before it reaches the database.
 *
 * ── Why memory and not Redis or a table ──────────────────────────────────────
 * The web app runs as one Node process (systemd `dye-web.service`, one
 * container in compose), so a Map is exact and costs nothing. It is not the
 * integrity rule — `kiemTraConLuot` in @dye/core still is, and still runs — so
 * losing the map on a restart forgets a few seconds of cooldown, never an
 * attempt. If the web tier is ever scaled out, this becomes a Redis
 * `SET NX PX`; the call sites do not change.
 *
 * Kept on `globalThis` so a dev-server hot reload does not quietly hand every
 * student a fresh window.
 */

/** Between two hand-ins by the same student — code, blocks or a .hex. */
export const KHOANG_CHO_NOP_MS = 5000;

/** Between two questions to Bí. Each one is a paid model call. */
export const KHOANG_CHO_TRO_LY_MS = 3000;

/**
 * Between two class-chat messages from the same student.
 *
 * Shorter than the tutor's — a chat line is a reply, and "ok" then "cảm ơn"
 * two seconds apart is a normal conversation — but still there, because each
 * message can be a paid classifier call and a held Enter key is thirty of them.
 */
export const KHOANG_CHO_THAO_LUAN_MS = 2000;

/** Entries before expired ones are swept. Well above one school's users. */
const NGUONG_DON_DEP = 5000;

const KHOA_KHO = Symbol.for('dye.gioi-han-toc-do');

function kho(): Map<string, number> {
  const g = globalThis as { [KHOA_KHO]?: Map<string, number> };
  return (g[KHOA_KHO] ??= new Map());
}

export interface KetQuaGioiHan {
  duocPhep: boolean;
  /** How long until the next attempt is allowed. 0 when this one was. */
  conLaiMs: number;
}

/**
 * Take the slot for (`nhom`, `userId`) if it is free.
 *
 * Synchronous on purpose: there is no `await` between reading the slot and
 * taking it, so two requests in the same tick cannot both get through.
 */
export function thuChiemLuot(
  nhom: string,
  userId: string,
  khoangMs: number,
  bayGio: number = Date.now(),
): KetQuaGioiHan {
  const m = kho();
  const khoa = `${nhom}:${userId}`;

  const hetHan = m.get(khoa);
  if (hetHan !== undefined && hetHan > bayGio) {
    return { duocPhep: false, conLaiMs: hetHan - bayGio };
  }

  if (m.size >= NGUONG_DON_DEP) {
    for (const [k, h] of m) if (h <= bayGio) m.delete(k);
  }

  m.set(khoa, bayGio + khoangMs);
  return { duocPhep: true, conLaiMs: 0 };
}

/** The sentence a student sees. Seconds, rounded up — "chờ 0 giây" is a lie. */
export function thongDiepChoLai(conLaiMs: number): string {
  const giay = Math.max(1, Math.ceil(conLaiMs / 1000));
  return `Em bấm hơi nhanh rồi. Chờ ${giay} giây nữa rồi thử lại nhé.`;
}

/** Tests only: forget every cooldown. */
export function xoaGioiHanChoKiemThu(): void {
  kho().clear();
}
