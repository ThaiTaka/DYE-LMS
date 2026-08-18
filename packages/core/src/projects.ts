/**
 * Pygame project workspace.
 *
 * ── How a project is shaped ──────────────────────────────────────────────────
 * Across the 30-session Pygame course each student builds one game. That game
 * lives as a `GameProject` with a chain of `ProjectVersion`s:
 *
 *   version N   submittedAt = null   ← the live working copy, freely editable
 *   version N-1 submittedAt = <date> ← frozen, what a teacher reviewed
 *   version N-2 submittedAt = <date> ← frozen
 *
 * Exactly one draft exists at a time. Submitting stamps it and opens a fresh
 * draft carrying the same files forward, so a student never loses their place
 * and a teacher's feedback always points at bytes that cannot change under them.
 *
 * ── Storage ──────────────────────────────────────────────────────────────────
 * This module never touches a filesystem. It takes a `KhoLuuTru` port, so the
 * same logic runs against local disk in development and object storage later,
 * and the tests can use an in-memory store without pretending.
 *
 * The student's filename is NEVER a storage path. Bytes are addressed by their
 * own SHA-256; `ProjectFile.path` is a label for display and nothing else.
 */
import { createHash } from 'node:crypto';

import { ForbiddenError } from './errors';
import {
  conDuDungLuong,
  kiemTraDuongDan,
  kiemTraTepTai,
  layDuoi,
  timDinhDang,
  GIOI_HAN_DU_AN_BYTE,
  SO_TEP_TOI_DA,
  type KetQuaKiemTra,
} from './upload-guard';

import type { PrismaClient, ProjectStatus, ProjectTemplate } from '@prisma/client';

/** Content-addressed blob store. Implemented by the web app; faked in tests. */
export interface KhoLuuTru {
  ghi(key: string, data: Uint8Array): Promise<void>;
  doc(key: string): Promise<Uint8Array | null>;
  xoa(key: string): Promise<void>;
}

export function bamNoiDung(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Storage key derived purely from content.
 *
 * Two students uploading the same sprite share one blob, and no student-supplied
 * string ever reaches the storage layer. The two-character prefix keeps
 * directory listings sane on a filesystem backend.
 */
export function khoaLuuTru(sha256: string): string {
  return `${sha256.slice(0, 2)}/${sha256}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Access
// ═══════════════════════════════════════════════════════════════════════════

/** The student owns it, or a teacher who actually teaches them, or an admin. */
export async function moDuAn(
  db: PrismaClient,
  actor: { id: string; role: string; isActive: boolean },
  projectId: string,
): Promise<{ id: string; studentId: string; title: string; status: ProjectStatus }> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');

  const duAn = await db.gameProject.findUnique({
    where: { id: projectId },
    select: { id: true, studentId: true, title: true, status: true },
  });
  // Unknown id is forbidden, not missing: which ids exist is itself information.
  if (!duAn) throw new ForbiddenError('project-not-found');

  if (actor.role === 'ADMIN') return duAn;
  if (actor.role === 'STUDENT') {
    if (duAn.studentId === actor.id) return duAn;
    throw new ForbiddenError('student-cross-account');
  }

  const day = await db.enrollment.findFirst({
    where: { studentId: duAn.studentId, isActive: true, class: { teacherId: actor.id } },
    select: { id: true },
  });
  if (!day) throw new ForbiddenError('teacher-does-not-teach-student');
  return duAn;
}

/** Only the owning student may change the working copy. */
export async function moDuAnDeSua(
  db: PrismaClient,
  actor: { id: string; role: string; isActive: boolean },
  projectId: string,
): Promise<{ id: string; studentId: string; title: string; status: ProjectStatus }> {
  const duAn = await moDuAn(db, actor, projectId);
  if (actor.role !== 'STUDENT' || duAn.studentId !== actor.id) {
    // A teacher reviews and comments; they do not edit a child's work under
    // their name. Changing it would destroy the meaning of the submission.
    throw new ForbiddenError('only-owner-edits-project');
  }
  return duAn;
}

// ═══════════════════════════════════════════════════════════════════════════
// Versions
// ═══════════════════════════════════════════════════════════════════════════

export interface BanLamViec {
  versionId: string;
  version: number;
  soTep: number;
  tongByte: number;
}

/**
 * The current draft, created on first use.
 *
 * Idempotent: concurrent callers converge on the same row because
 * `(projectId, version)` is unique and a lost race simply re-reads.
 */
export async function banLamViec(db: PrismaClient, projectId: string): Promise<BanLamViec> {
  const dangCo = await db.projectVersion.findFirst({
    where: { projectId, submittedAt: null },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, files: { select: { sizeBytes: true } } },
  });

  if (dangCo) {
    return {
      versionId: dangCo.id,
      version: dangCo.version,
      soTep: dangCo.files.length,
      tongByte: dangCo.files.reduce((n, f) => n + f.sizeBytes, 0),
    };
  }

  const cuoi = await db.projectVersion.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const soMoi = (cuoi?.version ?? 0) + 1;

  try {
    const moi = await db.projectVersion.create({
      data: { projectId, version: soMoi, note: '' },
      select: { id: true, version: true },
    });
    return { versionId: moi.id, version: moi.version, soTep: 0, tongByte: 0 };
  } catch {
    // Lost the race; the winner's row is the one we want.
    return banLamViec(db, projectId);
  }
}

export interface TepDuAn {
  id: string;
  path: string;
  sizeBytes: number;
  sniffedMime: string;
  sha256: string;
  storageKey: string;
  createdAt: Date;
  /** True when this file can be opened in the code editor. */
  suaDuoc: boolean;
}

export async function danhSachTep(db: PrismaClient, versionId: string): Promise<TepDuAn[]> {
  const rows = await db.projectFile.findMany({
    where: { versionId },
    orderBy: { path: 'asc' },
    select: {
      id: true,
      path: true,
      sizeBytes: true,
      sniffedMime: true,
      sha256: true,
      storageKey: true,
      createdAt: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    suaDuoc: timDinhDang(layDuoi(r.path))?.laVanBan ?? false,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Writing files
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaGhiTep {
  ok: boolean;
  tep: TepDuAn | null;
  lyDo: string;
  ma: KetQuaKiemTra['ma'] | 'qua-nhieu-tep' | 'het-dung-luong' | 'ok';
}

/**
 * Add or replace one file in the working copy.
 *
 * Validation runs BEFORE anything is written, so a refused upload leaves no
 * blob, no row, and no half-created folder.
 */
export async function ghiTep(
  db: PrismaClient,
  kho: KhoLuuTru,
  versionId: string,
  duongDanRaw: string,
  data: Uint8Array,
): Promise<KetQuaGhiTep> {
  const kiem = kiemTraTepTai(duongDanRaw, data);
  if (!kiem.ok) return { ok: false, tep: null, lyDo: kiem.lyDo, ma: kiem.ma };

  const hienCo = await db.projectFile.findMany({
    where: { versionId },
    select: { id: true, path: true, sizeBytes: true },
  });

  const thayThe = hienCo.find((f) => f.path === kiem.duongDan);

  if (!thayThe && hienCo.length >= SO_TEP_TOI_DA) {
    return {
      ok: false,
      tep: null,
      lyDo: `Dự án đã có ${SO_TEP_TOI_DA} tệp — nhiều nhất rồi. Em xoá bớt tệp cũ nhé.`,
      ma: 'qua-nhieu-tep',
    };
  }

  // Replacing a file frees its old bytes, so they do not count against the quota.
  const dangDung =
    hienCo.reduce((n, f) => n + f.sizeBytes, 0) - (thayThe?.sizeBytes ?? 0);
  const du = conDuDungLuong(dangDung, data.length);
  if (!du.ok) return { ok: false, tep: null, lyDo: du.lyDo, ma: 'het-dung-luong' };

  const sha256 = bamNoiDung(data);
  const storageKey = khoaLuuTru(sha256);

  await kho.ghi(storageKey, data);

  const row = await db.projectFile.upsert({
    where: { versionId_path: { versionId, path: kiem.duongDan } },
    create: {
      versionId,
      path: kiem.duongDan,
      sizeBytes: data.length,
      sniffedMime: kiem.mime,
      sha256,
      storageKey,
    },
    update: { sizeBytes: data.length, sniffedMime: kiem.mime, sha256, storageKey },
    select: {
      id: true,
      path: true,
      sizeBytes: true,
      sniffedMime: true,
      sha256: true,
      storageKey: true,
      createdAt: true,
    },
  });

  return {
    ok: true,
    tep: { ...row, suaDuoc: kiem.dinhDang?.laVanBan ?? false },
    lyDo: '',
    ma: 'ok',
  };
}

/**
 * Remove a file from the working copy.
 *
 * The blob is deliberately NOT deleted. It is content-addressed, so a submitted
 * version or another student's project may reference the identical bytes;
 * deleting here would silently corrupt a frozen snapshot someone already
 * reviewed. Reclaiming unreferenced blobs is a separate, auditable sweep.
 */
export async function xoaTep(
  db: PrismaClient,
  versionId: string,
  path: string,
): Promise<boolean> {
  const { count } = await db.projectFile.deleteMany({ where: { versionId, path } });
  return count > 0;
}

/** Rename within the working copy, keeping the same bytes. */
export async function doiTenTep(
  db: PrismaClient,
  versionId: string,
  cu: string,
  moi: string,
): Promise<KetQuaGhiTep> {
  const tep = await db.projectFile.findUnique({
    where: { versionId_path: { versionId, path: cu } },
    select: { id: true, sizeBytes: true, sniffedMime: true, sha256: true, storageKey: true },
  });
  if (!tep) return { ok: false, tep: null, lyDo: 'Không tìm thấy tệp.', ma: 'duong-dan' };

  // Only the PATH is re-validated: the bytes have not changed, so re-sniffing
  // them would be checking something we already know.
  const dd = kiemTraDuongDan(moi);
  if (!dd.ok) return { ok: false, tep: null, lyDo: dd.lyDo, ma: 'duong-dan' };

  const duoiCu = layDuoi(cu);
  const duoiMoi = layDuoi(dd.duongDan);
  if (duoiCu !== duoiMoi) {
    // Renaming player.png to player.py would otherwise be a way to turn an
    // image into something the editor treats as a script.
    return {
      ok: false,
      tep: null,
      lyDo: 'Không đổi được đuôi tệp khi đổi tên. Em tải lại tệp với tên mới nhé.',
      ma: 'khong-khop-noi-dung',
    };
  }

  const daCo = await db.projectFile.findUnique({
    where: { versionId_path: { versionId, path: dd.duongDan } },
    select: { id: true },
  });
  if (daCo) return { ok: false, tep: null, lyDo: 'Đã có tệp trùng tên.', ma: 'duong-dan' };

  const row = await db.projectFile.update({
    where: { id: tep.id },
    data: { path: dd.duongDan },
    select: {
      id: true,
      path: true,
      sizeBytes: true,
      sniffedMime: true,
      sha256: true,
      storageKey: true,
      createdAt: true,
    },
  });

  return {
    ok: true,
    tep: { ...row, suaDuoc: timDinhDang(duoiMoi)?.laVanBan ?? false },
    lyDo: '',
    ma: 'ok',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Submitting
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaNopMoc {
  ok: boolean;
  versionDaNop: number | null;
  versionMoi: number | null;
  lyDo: string;
}

/**
 * Freeze the working copy and open a new one.
 *
 * The files are copied forward rather than moved, so the submitted version keeps
 * exactly the rows a teacher will look at while the student carries on working.
 * Blobs are shared: both versions point at the same content-addressed keys, and
 * nothing is duplicated on disk.
 */
export async function nopMoc(
  db: PrismaClient,
  projectId: string,
  note: string,
): Promise<KetQuaNopMoc> {
  const ban = await banLamViec(db, projectId);

  if (ban.soTep === 0) {
    return {
      ok: false,
      versionDaNop: null,
      versionMoi: null,
      lyDo: 'Dự án chưa có tệp nào. Em thêm ít nhất một tệp rồi nộp nhé.',
    };
  }

  const coPython = await db.projectFile.findFirst({
    where: { versionId: ban.versionId, path: { endsWith: '.py' } },
    select: { id: true },
  });
  if (!coPython) {
    return {
      ok: false,
      versionDaNop: null,
      versionMoi: null,
      lyDo: 'Dự án cần ít nhất một tệp .py để thầy cô xem được code của em.',
    };
  }

  const tep = await db.projectFile.findMany({
    where: { versionId: ban.versionId },
    select: { path: true, sizeBytes: true, sniffedMime: true, sha256: true, storageKey: true },
  });

  const ketQua = await db.$transaction(async (tx) => {
    await tx.projectVersion.update({
      where: { id: ban.versionId },
      data: { submittedAt: new Date(), note },
    });

    const moi = await tx.projectVersion.create({
      data: { projectId, version: ban.version + 1, note: '' },
      select: { id: true, version: true },
    });

    await tx.projectFile.createMany({
      data: tep.map((t) => ({ versionId: moi.id, ...t })),
    });

    await tx.gameProject.update({
      where: { id: projectId },
      data: { status: 'SUBMITTED' },
    });

    return moi.version;
  });

  return { ok: true, versionDaNop: ban.version, versionMoi: ketQua, lyDo: '' };
}

/** Teacher decision on a submitted version. */
export async function ghiNhanXet(
  db: PrismaClient,
  actor: { id: string; role: string; isActive: boolean },
  versionId: string,
  comment: string,
  trangThai: ProjectStatus,
): Promise<void> {
  const ban = await db.projectVersion.findUnique({
    where: { id: versionId },
    select: { id: true, projectId: true, submittedAt: true },
  });
  if (!ban) throw new ForbiddenError('version-not-found');

  await moDuAn(db, actor, ban.projectId);
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-review');

  // Reviewing an unsubmitted draft would comment on bytes the student is still
  // changing, so the feedback would be about something that no longer exists.
  if (!ban.submittedAt) throw new ForbiddenError('version-not-submitted');

  await db.$transaction([
    db.feedback.create({
      data: { authorId: actor.id, projectVersionId: versionId, comment },
    }),
    db.gameProject.update({ where: { id: ban.projectId }, data: { status: trangThai } }),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// Creating
// ═══════════════════════════════════════════════════════════════════════════

/** Starter files per template, so a new project is never an empty screen. */
export const MAU_DU_AN: Record<ProjectTemplate, { ten: string; moTa: string }> = {
  SPACE_INVADERS: { ten: 'Bắn phi thuyền', moTa: 'Phi thuyền bắn thiên thạch rơi xuống.' },
  PLATFORMER: { ten: 'Nhảy vượt chướng ngại', moTa: 'Nhân vật chạy, nhảy, tránh bẫy.' },
  PONG: { ten: 'Pong', moTa: 'Hai thanh đỡ và một quả bóng.' },
  MAZE: { ten: 'Mê cung kho báu', moTa: 'Tìm đường trong mê cung để lấy kho báu.' },
  QUIZ_GUI: { ten: 'Trò chơi đố vui', moTa: 'Câu hỏi trắc nghiệm có giao diện.' },
  CUSTOM: { ten: 'Tự do', moTa: 'Em tự nghĩ ra trò chơi của mình.' },
};

export async function taoDuAn(
  db: PrismaClient,
  studentId: string,
  courseId: string,
  title: string,
  template: ProjectTemplate,
): Promise<{ id: string }> {
  const ten = title.trim().slice(0, 120) || MAU_DU_AN[template].ten;

  const duAn = await db.gameProject.create({
    data: {
      studentId,
      courseId,
      title: ten,
      template,
      description: MAU_DU_AN[template].moTa,
      status: 'DRAFT',
    },
    select: { id: true },
  });

  await banLamViec(db, duAn.id);
  return duAn;
}

export { GIOI_HAN_DU_AN_BYTE };
