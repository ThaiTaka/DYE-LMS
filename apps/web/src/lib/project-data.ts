import 'server-only';

/**
 * View models for the Pygame project workspace.
 *
 * Every entry point resolves access through `moDuAn` / `moDuAnDeSua` in
 * `@dye/core` before reading anything, so a teacher who does not teach the
 * student is refused rather than shown an empty workspace.
 */
import {
  banLamViec,
  danhSachTep,
  moDuAn,
  visibleStudentIds,
  type Actor,
  type TepDuAn,
} from '@dye/core';

import { db } from './db';
import { khoDuAn } from './project-storage';

import type { ProjectStatus, ProjectTemplate } from '@prisma/client';

export const NHAN_TRANG_THAI: Record<ProjectStatus, { nhan: string; lop: string }> = {
  DRAFT: { nhan: 'Đang làm', lop: 'bg-the-mo text-chu-phu' },
  SUBMITTED: { nhan: 'Đã nộp, chờ thầy cô xem', lop: 'bg-chinh-nhat text-chinh' },
  IN_REVIEW: { nhan: 'Thầy cô đang xem', lop: 'bg-thu-thach-nen text-thu-thach' },
  CHANGES_REQUESTED: { nhan: 'Cần chỉnh thêm', lop: 'bg-thu-lai-nen text-thu-lai' },
  APPROVED: { nhan: 'Đã duyệt 🎉', lop: 'bg-dung-nen text-dung' },
};

export interface TheDuAn {
  id: string;
  title: string;
  description: string;
  template: ProjectTemplate;
  status: ProjectStatus;
  soTep: number;
  tongByte: number;
  banHienTai: number;
  soLanNop: number;
  capNhat: Date;
}

export async function duAnCuaEm(studentId: string): Promise<TheDuAn[]> {
  const rows = await db.gameProject.findMany({
    where: { studentId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      template: true,
      status: true,
      updatedAt: true,
      versions: {
        orderBy: { version: 'desc' },
        select: {
          version: true,
          submittedAt: true,
          files: { select: { sizeBytes: true } },
        },
      },
    },
  });

  return rows.map((p) => {
    const nhap = p.versions.find((v) => v.submittedAt === null);
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      template: p.template,
      status: p.status,
      soTep: nhap?.files.length ?? 0,
      tongByte: nhap?.files.reduce((n, f) => n + f.sizeBytes, 0) ?? 0,
      banHienTai: nhap?.version ?? p.versions[0]?.version ?? 1,
      soLanNop: p.versions.filter((v) => v.submittedAt !== null).length,
      capNhat: p.updatedAt,
    };
  });
}

export interface BanDaNop {
  versionId: string;
  version: number;
  note: string;
  submittedAt: Date;
  soTep: number;
  nhanXet: Array<{ id: string; comment: string; tenGiaoVien: string; luc: Date }>;
}

export interface KhongGianLamViec {
  duAn: {
    id: string;
    title: string;
    description: string;
    template: ProjectTemplate;
    status: ProjectStatus;
    studentId: string;
    tenHocSinh: string;
  };
  ban: { versionId: string; version: number };
  tep: TepDuAn[];
  tongByte: number;
  daNop: BanDaNop[];
  /** True when the viewer owns this project and may edit it. */
  suaDuoc: boolean;
}

export async function khongGianLamViec(
  actor: Actor,
  projectId: string,
): Promise<KhongGianLamViec | null> {
  // Throws for a viewer with no relationship to this student.
  await moDuAn(db, actor, projectId);

  const duAn = await db.gameProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      description: true,
      template: true,
      status: true,
      studentId: true,
      student: { select: { displayName: true } },
    },
  });
  if (!duAn) return null;

  const ban = await banLamViec(db, projectId);
  const tep = await danhSachTep(db, ban.versionId);

  const daNopRaw = await db.projectVersion.findMany({
    where: { projectId, submittedAt: { not: null } },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      note: true,
      submittedAt: true,
      files: { select: { id: true } },
      feedback: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          comment: true,
          createdAt: true,
          author: { select: { displayName: true } },
        },
      },
    },
  });

  return {
    duAn: {
      id: duAn.id,
      title: duAn.title,
      description: duAn.description,
      template: duAn.template,
      status: duAn.status,
      studentId: duAn.studentId,
      tenHocSinh: duAn.student.displayName,
    },
    ban: { versionId: ban.versionId, version: ban.version },
    tep,
    tongByte: ban.tongByte,
    daNop: daNopRaw.map((v) => ({
      versionId: v.id,
      version: v.version,
      note: v.note,
      submittedAt: v.submittedAt!,
      soTep: v.files.length,
      nhanXet: v.feedback.map((f) => ({
        id: f.id,
        comment: f.comment,
        tenGiaoVien: f.author.displayName,
        luc: f.createdAt,
      })),
    })),
    suaDuoc: actor.role === 'STUDENT' && duAn.studentId === actor.id,
  };
}

/** Text content of one file, for the editor. Binary files return null. */
export async function noiDungTep(
  actor: Actor,
  projectId: string,
  fileId: string,
): Promise<{ path: string; code: string } | null> {
  await moDuAn(db, actor, projectId);

  const tep = await db.projectFile.findFirst({
    // Scoped to this project: a file id from another student's project must not
    // resolve just because the caller can open some project.
    where: { id: fileId, version: { projectId } },
    select: { path: true, storageKey: true, sniffedMime: true },
  });
  if (!tep) return null;

  const duLieu = await khoDuAn.doc(tep.storageKey);
  if (!duLieu) return null;

  try {
    return { path: tep.path, code: new TextDecoder('utf-8', { fatal: true }).decode(duLieu) };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Teacher review queue
// ═══════════════════════════════════════════════════════════════════════════

export interface DuAnChoDuyet {
  projectId: string;
  title: string;
  tenHocSinh: string;
  studentId: string;
  status: ProjectStatus;
  versionId: string;
  version: number;
  note: string;
  submittedAt: Date;
  soTep: number;
  daCoNhanXet: boolean;
}

/**
 * Submitted versions this teacher may review.
 *
 * Scoped by `visibleStudentIds`, the same relationship `authorize()` uses, so
 * this list and a detail page can never disagree about who is visible.
 */
export async function hangChoDuyet(actor: Actor): Promise<DuAnChoDuyet[]> {
  const ids = await visibleStudentIds(db, actor);
  if (ids.length === 0) return [];

  const rows = await db.projectVersion.findMany({
    where: {
      submittedAt: { not: null },
      project: { studentId: { in: ids } },
    },
    orderBy: { submittedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      version: true,
      note: true,
      submittedAt: true,
      files: { select: { id: true } },
      feedback: { select: { id: true } },
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          studentId: true,
          student: { select: { displayName: true } },
        },
      },
    },
  });

  return rows.map((v) => ({
    projectId: v.project.id,
    title: v.project.title,
    tenHocSinh: v.project.student.displayName,
    studentId: v.project.studentId,
    status: v.project.status,
    versionId: v.id,
    version: v.version,
    note: v.note,
    submittedAt: v.submittedAt!,
    soTep: v.files.length,
    daCoNhanXet: v.feedback.length > 0,
  }));
}

/** One submitted version, with its files, for the teacher's review page. */
export async function banDeDuyet(
  actor: Actor,
  versionId: string,
): Promise<{
  duAn: { id: string; title: string; tenHocSinh: string; status: ProjectStatus };
  version: number;
  note: string;
  submittedAt: Date;
  tep: TepDuAn[];
  nhanXet: Array<{ id: string; comment: string; tenGiaoVien: string; luc: Date }>;
} | null> {
  const ban = await db.projectVersion.findUnique({
    where: { id: versionId },
    select: { id: true, projectId: true, version: true, note: true, submittedAt: true },
  });
  if (!ban || !ban.submittedAt) return null;

  await moDuAn(db, actor, ban.projectId);

  const duAn = await db.gameProject.findUniqueOrThrow({
    where: { id: ban.projectId },
    select: {
      id: true,
      title: true,
      status: true,
      student: { select: { displayName: true } },
    },
  });

  const [tep, fb] = await Promise.all([
    danhSachTep(db, versionId),
    db.feedback.findMany({
      where: { projectVersionId: versionId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        comment: true,
        createdAt: true,
        author: { select: { displayName: true } },
      },
    }),
  ]);

  return {
    duAn: {
      id: duAn.id,
      title: duAn.title,
      tenHocSinh: duAn.student.displayName,
      status: duAn.status,
    },
    version: ban.version,
    note: ban.note,
    submittedAt: ban.submittedAt,
    tep,
    nhanXet: fb.map((f) => ({
      id: f.id,
      comment: f.comment,
      tenGiaoVien: f.author.displayName,
      luc: f.createdAt,
    })),
  };
}

/** The Pygame course, which is the only course projects attach to. */
export async function khoaPygame(): Promise<{ id: string; title: string } | null> {
  return db.course.findUnique({
    where: { slug: 'lap-trinh-game-pygame' },
    select: { id: true, title: true },
  });
}
