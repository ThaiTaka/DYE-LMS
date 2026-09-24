import 'server-only';

/**
 * View models for the class chat, shared by `GET /api/chat` and the two pages
 * that render the chat on first load (the student's `/thao-luan` and the
 * teacher's class page) — so the first paint and every poll after it are the
 * same shape, produced by the same function.
 *
 * Every read goes through `tinNhanCuaLop` / `trangThaiThaoLuan` in @dye/core,
 * which authorize `class: read` before a row is touched.
 */
import {
  lopThaoLuanCuaEm,
  tinNhanCuaLop,
  trangThaiThaoLuan,
  type Actor,
  type LopThaoLuan,
  type TinNhanLop,
} from '@dye/core';

import { db } from './db';

/** A message as the browser receives it. Dates are ISO strings. */
export interface TinNhanGuiDi {
  id: string;
  noiDung: string;
  luc: string;
  tacGia: { id: string; ten: string; anh: string | null };
}

export interface KetQuaDocThaoLuan {
  tinNhan: TinNhanGuiDi[];
  /** The viewer's own id, so the page can put their messages on the right. */
  toi: string;
  coTheGui: boolean;
  biKhoa: boolean;
  daLuuTru: boolean;
}

/** What `POST /api/chat` answers, whatever happened. */
export interface KetQuaGuiThaoLuan {
  trangThai: 'da-gui' | 'vi-pham' | 'bi-khoa' | 'tu-choi' | 'loi';
  /** A sentence for a child. Empty on success. */
  thongDiep: string;
  tinNhan?: TinNhanGuiDi;
}

export function thanhGuiDi(t: TinNhanLop): TinNhanGuiDi {
  return { id: t.id, noiDung: t.noiDung, luc: t.luc.toISOString(), tacGia: t.tacGia };
}

/** The feed and the composer's state. Throws `ForbiddenError` outside the class. */
export async function docThaoLuan(
  actor: Actor,
  classId: string,
  tu?: Date | undefined,
): Promise<KetQuaDocThaoLuan> {
  const [tinNhan, trangThai] = await Promise.all([
    tinNhanCuaLop(db, actor, classId, { tu }),
    trangThaiThaoLuan(db, actor, classId),
  ]);
  return { tinNhan: tinNhan.map(thanhGuiDi), toi: actor.id, ...trangThai };
}

export interface DuLieuTrangThaoLuan {
  lop: LopThaoLuan[];
  dangXem: LopThaoLuan | null;
  banDau: KetQuaDocThaoLuan | null;
}

/**
 * The student's chat page: their classes, the one being viewed, its feed.
 *
 * `lopChon` comes from the URL. It is looked up in the student's OWN list, so
 * an id for a class they are not in simply falls back to their first class
 * rather than reaching the authorization check at all.
 */
export async function duLieuTrangThaoLuan(
  actor: Actor,
  lopChon: string | undefined,
): Promise<DuLieuTrangThaoLuan> {
  const lop = await lopThaoLuanCuaEm(db, actor);
  const dangXem = lop.find((l) => l.id === lopChon) ?? lop[0] ?? null;
  const banDau = dangXem ? await docThaoLuan(actor, dangXem.id) : null;
  return { lop, dangXem, banDau };
}
