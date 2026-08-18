'use server';

/**
 * Project workspace actions.
 *
 * Every write re-resolves ownership through `@dye/core`. The upload path in
 * particular never trusts anything the browser said: not the declared MIME, not
 * the filename, not the size header. The bytes are read, hashed, sniffed, and
 * either accepted or refused.
 */
import {
  banLamViec,
  doiTenTep,
  ghiNhanXet,
  ghiTep,
  moDuAn,
  moDuAnDeSua,
  nopMoc,
  taoDuAn,
  xoaTep,
  ForbiddenError,
  GIOI_HAN_TEP_BYTE,
  UnauthorizedError,
} from '@dye/core';
import { revalidatePath } from 'next/cache';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';
import { khoaPygame } from '@/lib/project-data';
import { khoDuAn } from '@/lib/project-storage';

import type { Actor } from '@dye/core';
import type { ProjectStatus, ProjectTemplate } from '@prisma/client';

export interface KetQuaDuAn {
  trangThai: 'chua-lam' | 'thanh-cong' | 'tu-choi' | 'loi';
  thongDiep: string;
}

export const CHUA_LAM: KetQuaDuAn = { trangThai: 'chua-lam', thongDiep: '' };

const MAU_HOP_LE: ProjectTemplate[] = [
  'SPACE_INVADERS',
  'PLATFORMER',
  'PONG',
  'MAZE',
  'QUIZ_GUI',
  'CUSTOM',
];

const TRANG_THAI_DUYET: ProjectStatus[] = ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'];

async function ai(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new UnauthorizedError('no-session');
  return actor;
}

/** Expected refusals become messages; genuine faults stay loud in the log. */
function thanhThongDiep(error: unknown): KetQuaDuAn {
  if (error instanceof ForbiddenError) {
    return { trangThai: 'tu-choi', thongDiep: 'Em không có quyền làm việc này.' };
  }
  if (error instanceof UnauthorizedError) {
    return { trangThai: 'tu-choi', thongDiep: 'Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.' };
  }
  console.error('[du-an] hành động thất bại', error);
  return { trangThai: 'loi', thongDiep: 'Có lỗi kỹ thuật. Em thử lại giúp nhé.' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Project lifecycle
// ═══════════════════════════════════════════════════════════════════════════

export async function taoDuAnMoi(_truoc: KetQuaDuAn, form: FormData): Promise<KetQuaDuAn> {
  try {
    const actor = await ai();
    if (actor.role !== 'STUDENT') {
      return { trangThai: 'tu-choi', thongDiep: 'Chỉ học sinh mới tạo được dự án.' };
    }

    const title = String(form.get('title') ?? '');
    const mauRaw = String(form.get('template') ?? 'CUSTOM');
    const template = MAU_HOP_LE.find((m) => m === mauRaw) ?? 'CUSTOM';

    const khoa = await khoaPygame();
    if (!khoa) return { trangThai: 'loi', thongDiep: 'Chưa tìm thấy khoá Lập Trình Game.' };

    const duAn = await taoDuAn(db, actor.id, khoa.id, title, template);
    revalidatePath('/du-an');

    return { trangThai: 'thanh-cong', thongDiep: `Đã tạo dự án. Mã: ${duAn.id}` };
  } catch (error) {
    return thanhThongDiep(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Files
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaTaiLen extends KetQuaDuAn {
  /** Per-file outcome, so partial success is reported honestly. */
  chiTiet: Array<{ ten: string; ok: boolean; lyDo: string }>;
}

/**
 * Upload one or more files.
 *
 * Reads the actual bytes rather than trusting `File.type` or `File.size`. Each
 * file is judged on its own, so one bad asset does not discard a good batch —
 * and the caller is told exactly which ones were refused and why.
 */
export async function taiTepLen(
  _truoc: KetQuaTaiLen,
  form: FormData,
): Promise<KetQuaTaiLen> {
  try {
    const actor = await ai();
    const projectId = String(form.get('projectId') ?? '');
    await moDuAnDeSua(db, actor, projectId);

    const thuMuc = String(form.get('thuMuc') ?? '').trim();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return { trangThai: 'loi', thongDiep: 'Em chưa chọn tệp nào.', chiTiet: [] };
    }

    const ban = await banLamViec(db, projectId);
    const chiTiet: Array<{ ten: string; ok: boolean; lyDo: string }> = [];

    for (const f of files) {
      // The browser's reported size is a hint, not a fact. Reading the bytes is
      // what settles it — but refuse the obviously-huge before buffering it.
      if (f.size > GIOI_HAN_TEP_BYTE) {
        chiTiet.push({ ten: f.name, ok: false, lyDo: 'Tệp lớn hơn 5 MB.' });
        continue;
      }

      const data = new Uint8Array(await f.arrayBuffer());
      const duongDan = thuMuc ? `${thuMuc}/${f.name}` : f.name;

      const kq = await ghiTep(db, khoDuAn, ban.versionId, duongDan, data);
      chiTiet.push({ ten: f.name, ok: kq.ok, lyDo: kq.lyDo });
    }

    revalidatePath(`/du-an/${projectId}`);

    const dat = chiTiet.filter((c) => c.ok).length;
    const hong = chiTiet.length - dat;

    return {
      trangThai: hong === 0 ? 'thanh-cong' : dat === 0 ? 'tu-choi' : 'thanh-cong',
      thongDiep:
        hong === 0
          ? `Đã tải lên ${dat} tệp.`
          : dat === 0
            ? 'Không tệp nào được nhận.'
            : `Đã tải lên ${dat} tệp, ${hong} tệp bị từ chối.`,
      chiTiet,
    };
  } catch (error) {
    return { ...thanhThongDiep(error), chiTiet: [] };
  }
}

/** Create or overwrite a text file from the editor. */
export async function luuTepVanBan(
  _truoc: KetQuaDuAn,
  form: FormData,
): Promise<KetQuaDuAn> {
  try {
    const actor = await ai();
    const projectId = String(form.get('projectId') ?? '');
    await moDuAnDeSua(db, actor, projectId);

    const duongDan = String(form.get('duongDan') ?? '');
    const code = String(form.get('code') ?? '');

    const ban = await banLamViec(db, projectId);
    const kq = await ghiTep(db, khoDuAn, ban.versionId, duongDan, new TextEncoder().encode(code));

    revalidatePath(`/du-an/${projectId}`);

    return kq.ok
      ? { trangThai: 'thanh-cong', thongDiep: `Đã lưu ${kq.tep?.path}.` }
      : { trangThai: 'tu-choi', thongDiep: kq.lyDo };
  } catch (error) {
    return thanhThongDiep(error);
  }
}

export async function xoaTepDuAn(_truoc: KetQuaDuAn, form: FormData): Promise<KetQuaDuAn> {
  try {
    const actor = await ai();
    const projectId = String(form.get('projectId') ?? '');
    await moDuAnDeSua(db, actor, projectId);

    const duongDan = String(form.get('duongDan') ?? '');
    const ban = await banLamViec(db, projectId);
    const xoa = await xoaTep(db, ban.versionId, duongDan);

    revalidatePath(`/du-an/${projectId}`);

    return xoa
      ? { trangThai: 'thanh-cong', thongDiep: `Đã xoá ${duongDan}.` }
      : { trangThai: 'loi', thongDiep: 'Không tìm thấy tệp.' };
  } catch (error) {
    return thanhThongDiep(error);
  }
}

export async function doiTen(_truoc: KetQuaDuAn, form: FormData): Promise<KetQuaDuAn> {
  try {
    const actor = await ai();
    const projectId = String(form.get('projectId') ?? '');
    await moDuAnDeSua(db, actor, projectId);

    const ban = await banLamViec(db, projectId);
    const kq = await doiTenTep(
      db,
      ban.versionId,
      String(form.get('cu') ?? ''),
      String(form.get('moi') ?? ''),
    );

    revalidatePath(`/du-an/${projectId}`);

    return kq.ok
      ? { trangThai: 'thanh-cong', thongDiep: `Đã đổi tên thành ${kq.tep?.path}.` }
      : { trangThai: 'tu-choi', thongDiep: kq.lyDo };
  } catch (error) {
    return thanhThongDiep(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Milestones
// ═══════════════════════════════════════════════════════════════════════════

export async function nopMocDuAn(_truoc: KetQuaDuAn, form: FormData): Promise<KetQuaDuAn> {
  try {
    const actor = await ai();
    const projectId = String(form.get('projectId') ?? '');
    await moDuAnDeSua(db, actor, projectId);

    const note = String(form.get('note') ?? '').trim().slice(0, 1000);
    const kq = await nopMoc(db, projectId, note);

    revalidatePath(`/du-an/${projectId}`);
    revalidatePath('/giao-vien/du-an');

    return kq.ok
      ? {
          trangThai: 'thanh-cong',
          thongDiep:
            `Đã nộp bản ${kq.versionDaNop}. Thầy cô sẽ xem và nhận xét. ` +
            `Em cứ tiếp tục làm ở bản ${kq.versionMoi} nhé.`,
        }
      : { trangThai: 'tu-choi', thongDiep: kq.lyDo };
  } catch (error) {
    return thanhThongDiep(error);
  }
}

/** Teacher feedback on a submitted version. */
export async function nhanXetDuAn(_truoc: KetQuaDuAn, form: FormData): Promise<KetQuaDuAn> {
  try {
    const actor = await ai();
    const versionId = String(form.get('versionId') ?? '');
    const comment = String(form.get('comment') ?? '').trim();
    const ttRaw = String(form.get('trangThai') ?? '');

    if (comment.length < 3) {
      return { trangThai: 'loi', thongDiep: 'Thầy cô viết vài dòng nhận xét giúp em nhé.' };
    }
    const trangThai = TRANG_THAI_DUYET.find((t) => t === ttRaw);
    if (!trangThai) return { trangThai: 'loi', thongDiep: 'Trạng thái không hợp lệ.' };

    await ghiNhanXet(db, actor, versionId, comment.slice(0, 4000), trangThai);

    revalidatePath('/giao-vien/du-an');

    return { trangThai: 'thanh-cong', thongDiep: 'Đã gửi nhận xét cho em học sinh.' };
  } catch (error) {
    return thanhThongDiep(error);
  }
}

/** Read one text file for the editor. Returns null for binary or missing. */
export async function docTepDeSua(
  projectId: string,
  fileId: string,
): Promise<{ path: string; code: string } | null> {
  try {
    const actor = await ai();
    await moDuAn(db, actor, projectId);

    const { noiDungTep } = await import('@/lib/project-data');
    return await noiDungTep(actor, projectId, fileId);
  } catch {
    return null;
  }
}
