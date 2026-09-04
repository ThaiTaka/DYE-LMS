import 'server-only';

/**
 * View models for the teacher experience.
 *
 * ── The rule every function here obeys ───────────────────────────────────────
 * A teacher reaches a student ONLY through `Class.teacherId → Enrollment →
 * student`. Nothing here queries by role. Every entry point either calls
 * `authorize()` from @dye/core or derives its scope from `visibleStudentIds()`,
 * which is built from the same relationship — so a list view and a detail view
 * can never disagree about who is visible.
 *
 * ── What teachers see that students do not ───────────────────────────────────
 *   • `Lesson.teacherNotes` — the verbatim instructional note from the lesson plan
 *   • `Lesson.difficulty` — a planning aid, never a label shown to a child
 *   • `Problem.solutionCode` and hidden test cases (surfaced in Phase 7/8)
 *
 * ── What NOBODY sees ─────────────────────────────────────────────────────────
 * The words "yếu", "kém", "trung bình". Analytics here describe WORK — sessions
 * completed, days since last activity — never the child. The alert list is
 * called "cần hỗ trợ" (needs support) because that names an action the teacher
 * takes, not a property the student has.
 */
import {
  anhHuongXoaTaiKhoan,
  authorize,
  bocMarkdown,
  can,
  canhBaoTapTrung,
  courseProgress,
  khoaHocChoLop,
  nguoiCoTheNhanBanGiao,
  NGUONG_CANH_BAO,
  resolveCourseAccess,
  soCanhBaoChuaXuLy,
  stageOf,
  thongKeGiangDay,
  tierRank,
  tomTatTapTrung,
  visibleStudentIds,
  type Actor,
  type AnhHuongXoaTaiKhoan,
  type CanhBaoHienThi,
  type CourseProgress,
  type FlowStage,
  type KhoaHocChonDuoc,
  type LessonAccess,
  type ThongKeTongQuan,
  type TomTatTapTrung,
} from '@dye/core';

import { db } from './db';

import type { BlockType, LessonStatus, Role, Tier } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════════════

export interface TomTatLop {
  classId: string;
  code: string;
  name: string;
  term: string | null;
  siSo: number;
  courses: Array<{ courseId: string; slug: string; title: string; iconEmoji: string }>;
  /** Mean of each student's required-work percentage. */
  tiLeTrungBinh: number;
  /** Students whose required work is fully done. */
  soHoanThanh: number;
}

/** A student the teacher may want to look at today, and why. */
export interface HocSinhDangChuY {
  studentId: string;
  displayName: string;
  username: string;
  classId: string;
  className: string;
  courseId: string;
  courseTitle: string;
  tier: Tier;
  phanTram: number;
  daXong: number;
  tongBatBuoc: number;
  /** Days since the last completed lesson. Null when they have never finished one. */
  soNgayVang: number | null;
  /** Plain-language reason, phrased as a next action for the teacher. */
  lyDo: string;
}

export interface GoiYNangNhanh extends HocSinhDangChuY {
  /** The tier this student could move up to. Null when already at the top. */
  nhanhDeXuat: Tier | null;
  /** Optional/exploration work they have completed beyond what was required. */
  soLamThem: number;
}

export interface DuLieuBangGiaoVien {
  lop: TomTatLop[];
  tongHocSinh: number;
  tiLeTrungBinhChung: number;
  canHoTro: HocSinhDangChuY[];
  diNhanh: GoiYNangNhanh[];
}

/** Milliseconds in a day, for the "days since" arithmetic. */
const NGAY = 24 * 60 * 60 * 1000;

/**
 * A student is flagged for support when they are both behind their class AND
 * quiet. Either signal alone is noise: a student can be behind because they
 * joined late, and quiet for a week because of a school holiday.
 */
const NGUONG_VANG_NGAY = 10;
const NGUONG_TUT_LAI = 0.6;

/** Fast-track suggestion: finished their required work and reached beyond it. */
const NGUONG_LAM_THEM = 2;

export async function duLieuBangGiaoVien(actor: Actor): Promise<DuLieuBangGiaoVien> {
  const classes = await db.class.findMany({
    where: actor.role === 'ADMIN' ? { isArchived: false } : { teacherId: actor.id, isArchived: false },
    select: {
      id: true,
      code: true,
      name: true,
      term: true,
      classCourses: {
        select: {
          course: { select: { id: true, slug: true, title: true, iconEmoji: true } },
        },
      },
      enrollments: {
        where: { isActive: true },
        select: {
          student: { select: { id: true, displayName: true, username: true } },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  const lop: TomTatLop[] = [];
  const canHoTro: HocSinhDangChuY[] = [];
  const diNhanh: GoiYNangNhanh[] = [];
  const moiHocSinh = new Set<string>();
  const tatCaPhanTram: number[] = [];

  for (const klass of classes) {
    const courses = klass.classCourses.map((cc) => cc.course);
    const students = klass.enrollments.map((e) => e.student);
    for (const s of students) moiHocSinh.add(s.id);

    const phanTramLop: number[] = [];
    let soHoanThanh = 0;

    for (const course of courses) {
      // Progress resolves per student because the denominator is per student —
      // that is the whole point of Phase 4 and cannot be batched into one query.
      const rows = await Promise.all(
        students.map(async (student) => ({
          student,
          progress: await courseProgress(db, student.id, course.id),
          lastDone: await db.lessonProgress.findFirst({
            where: { studentId: student.id, state: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
            select: { completedAt: true },
          }),
        })),
      );

      const trungBinhKhoa =
        rows.length === 0
          ? 0
          : rows.reduce((sum, r) => sum + r.progress.required.percent, 0) / rows.length;

      for (const { student, progress, lastDone } of rows) {
        phanTramLop.push(progress.required.percent);
        if (progress.isComplete) soHoanThanh += 1;

        const soNgayVang = lastDone?.completedAt
          ? Math.floor((Date.now() - lastDone.completedAt.getTime()) / NGAY)
          : null;

        const chung = {
          studentId: student.id,
          displayName: student.displayName,
          username: student.username,
          classId: klass.id,
          className: klass.name,
          courseId: course.id,
          courseTitle: course.title,
          tier: progress.tier,
          phanTram: progress.required.percent,
          daXong: progress.required.completed,
          tongBatBuoc: progress.required.total,
          soNgayVang,
        };

        // ── Needs support ────────────────────────────────────────────────────
        const tutLai =
          progress.hasRequiredWork &&
          !progress.isComplete &&
          progress.required.percent < trungBinhKhoa * NGUONG_TUT_LAI;
        const vangLau = soNgayVang !== null && soNgayVang >= NGUONG_VANG_NGAY;

        if (tutLai || vangLau) {
          const lyDo = [
            tutLai ? `đang ở buổi ${progress.required.completed}/${progress.required.total}` : '',
            vangLau ? `chưa hoàn thành bài nào trong ${soNgayVang} ngày` : '',
          ]
            .filter(Boolean)
            .join(' · ');
          canHoTro.push({ ...chung, lyDo: `Nên hỏi thăm: ${lyDo}.` });
        }

        // ── Moving fast ──────────────────────────────────────────────────────
        const lamThem = progress.optional.completed;
        if (progress.isComplete || lamThem >= NGUONG_LAM_THEM) {
          const ke = nhanhKeTiep(progress.tier);
          diNhanh.push({
            ...chung,
            nhanhDeXuat: ke,
            soLamThem: lamThem,
            lyDo: progress.isComplete
              ? `Đã xong toàn bộ phần bắt buộc${lamThem > 0 ? ` và làm thêm ${lamThem} bài` : ''}.`
              : `Đã làm thêm ${lamThem} bài ngoài phần bắt buộc.`,
          });
        }
      }
    }

    const tiLeTrungBinh =
      phanTramLop.length === 0
        ? 0
        : Math.round(phanTramLop.reduce((a, b) => a + b, 0) / phanTramLop.length);
    tatCaPhanTram.push(...phanTramLop);

    lop.push({
      classId: klass.id,
      code: klass.code,
      name: klass.name,
      term: klass.term,
      siSo: students.length,
      courses: courses.map((c) => ({
        courseId: c.id,
        slug: c.slug,
        title: c.title,
        iconEmoji: c.iconEmoji,
      })),
      tiLeTrungBinh,
      soHoanThanh,
    });
  }

  // Most urgent first: longest silence, then furthest behind.
  canHoTro.sort((a, b) => (b.soNgayVang ?? 0) - (a.soNgayVang ?? 0) || a.phanTram - b.phanTram);
  diNhanh.sort((a, b) => b.soLamThem - a.soLamThem || b.phanTram - a.phanTram);

  return {
    lop,
    tongHocSinh: moiHocSinh.size,
    tiLeTrungBinhChung:
      tatCaPhanTram.length === 0
        ? 0
        : Math.round(tatCaPhanTram.reduce((a, b) => a + b, 0) / tatCaPhanTram.length),
    canHoTro: canHoTro.slice(0, 8),
    diNhanh: diNhanh.slice(0, 8),
  };
}

/** The next tier up, or null at the top of the scale. */
export function nhanhKeTiep(tier: Tier): Tier | null {
  const thang: Tier[] = ['CO_BAN', 'THU_THACH', 'NANG_CAO', 'MO_RONG'];
  const ke = thang[tierRank(tier) + 1];
  return ke ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Class detail
// ═══════════════════════════════════════════════════════════════════════════

export interface HangHocSinh {
  studentId: string;
  displayName: string;
  username: string;
  isActive: boolean;
  tier: Tier;
  progress: CourseProgress;
  soCanThiep: number;
}

export interface DuLieuLop {
  classId: string;
  code: string;
  name: string;
  term: string | null;
  courses: Array<{ courseId: string; slug: string; title: string; iconEmoji: string }>;
  /** The course the roster is currently reported against. */
  khoaHienTai: { courseId: string; slug: string; title: string } | null;
  hocSinh: HangHocSinh[];
  tiLeTrungBinh: number;
}

export async function duLieuLop(
  actor: Actor,
  classId: string,
  courseId?: string,
): Promise<DuLieuLop | null> {
  // The guard runs BEFORE any data is read: a teacher asking for someone else's
  // class must be refused, not merely shown an empty page.
  await authorize(db, actor, { resource: 'class', action: 'read', classId });

  const klass = await db.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      code: true,
      name: true,
      term: true,
      classCourses: {
        select: { course: { select: { id: true, slug: true, title: true, iconEmoji: true } } },
      },
      enrollments: {
        where: { isActive: true },
        select: {
          student: {
            select: { id: true, displayName: true, username: true, isActive: true },
          },
        },
      },
    },
  });
  if (!klass) return null;

  const courses = klass.classCourses.map((cc) => cc.course);
  const chon = courses.find((c) => c.id === courseId) ?? courses[0] ?? null;

  const hocSinh: HangHocSinh[] = [];
  if (chon) {
    for (const { student } of klass.enrollments) {
      const [progress, soCanThiep] = await Promise.all([
        courseProgress(db, student.id, chon.id),
        db.lessonOverride.count({
          where: { studentId: student.id, lesson: { courseId: chon.id } },
        }),
      ]);
      hocSinh.push({
        studentId: student.id,
        displayName: student.displayName,
        username: student.username,
        isActive: student.isActive,
        tier: progress.tier,
        progress,
        soCanThiep,
      });
    }
  }

  hocSinh.sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));

  return {
    classId: klass.id,
    code: klass.code,
    name: klass.name,
    term: klass.term,
    courses: courses.map((c) => ({
      courseId: c.id,
      slug: c.slug,
      title: c.title,
      iconEmoji: c.iconEmoji,
    })),
    khoaHienTai: chon ? { courseId: chon.id, slug: chon.slug, title: chon.title } : null,
    hocSinh,
    tiLeTrungBinh:
      hocSinh.length === 0
        ? 0
        : Math.round(
            hocSinh.reduce((sum, h) => sum + h.progress.required.percent, 0) / hocSinh.length,
          ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Student detail — where overrides are applied
// ═══════════════════════════════════════════════════════════════════════════

export interface CanThiepHienCo {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonOrder: number;
  isUnlocked: boolean | null;
  forceStatus: LessonStatus | null;
  waivePrerequisites: boolean;
  reason: string | null;
  createdAt: Date;
  createdBy: string;
  authorName: string;
  /** True when the override applies to the whole class, not this student. */
  phamViLop: boolean;
}

export interface DuLieuHocSinh {
  studentId: string;
  displayName: string;
  username: string;
  isActive: boolean;
  classId: string;
  className: string;
  course: { courseId: string; slug: string; title: string; iconEmoji: string };
  tier: Tier;
  ghiChuNhanh: string | null;
  progress: CourseProgress;
  baiHoc: LessonAccess[];
  canThiep: CanThiepHienCo[];
}

export async function duLieuHocSinh(
  actor: Actor,
  studentId: string,
  courseId?: string,
): Promise<DuLieuHocSinh | null> {
  // Relational check: refuses unless this actor genuinely teaches this student.
  await authorize(db, actor, { resource: 'student', action: 'read', studentId });

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      displayName: true,
      username: true,
      isActive: true,
      enrollments: {
        where: {
          isActive: true,
          ...(actor.role === 'ADMIN' ? {} : { class: { teacherId: actor.id } }),
        },
        select: {
          class: {
            select: {
              id: true,
              name: true,
              classCourses: {
                select: {
                  course: { select: { id: true, slug: true, title: true, iconEmoji: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!student) return null;

  const enrolment = student.enrollments[0];
  if (!enrolment) return null;

  const courses = enrolment.class.classCourses.map((cc) => cc.course);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];
  if (!course) return null;

  const [progress, baiHoc, track, overrides] = await Promise.all([
    courseProgress(db, studentId, course.id),
    resolveCourseAccess(db, studentId, course.id),
    db.trackAssignment.findUnique({
      where: { studentId_courseId: { studentId, courseId: course.id } },
      select: { note: true },
    }),
    db.lessonOverride.findMany({
      where: {
        lesson: { courseId: course.id },
        OR: [{ studentId }, { classId: enrolment.class.id, studentId: null }],
      },
      select: {
        id: true,
        lessonId: true,
        studentId: true,
        isUnlocked: true,
        forceStatus: true,
        waivePrerequisites: true,
        reason: true,
        createdAt: true,
        createdBy: true,
        lesson: { select: { title: true, order: true } },
        author: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    studentId: student.id,
    displayName: student.displayName,
    username: student.username,
    isActive: student.isActive,
    classId: enrolment.class.id,
    className: enrolment.class.name,
    course: {
      courseId: course.id,
      slug: course.slug,
      title: course.title,
      iconEmoji: course.iconEmoji,
    },
    tier: progress.tier,
    ghiChuNhanh: track?.note ?? null,
    progress,
    baiHoc,
    canThiep: overrides.map((o) => ({
      id: o.id,
      lessonId: o.lessonId,
      lessonTitle: bocMarkdown(o.lesson.title),
      lessonOrder: o.lesson.order,
      isUnlocked: o.isUnlocked,
      forceStatus: o.forceStatus,
      waivePrerequisites: o.waivePrerequisites,
      reason: o.reason,
      createdAt: o.createdAt,
      createdBy: o.createdBy,
      authorName: o.author.displayName,
      phamViLop: o.studentId === null,
    })),
  };
}

/**
 * Why `duLieuHocSinh` could not build a page for this child.
 *
 * That function returns `null` for three unrelated situations, and a page that
 * treats all three as `notFound()` tells the teacher the same untrue thing in
 * every one of them:
 *
 *   1. no such user            → genuinely not found
 *   2. in no class we can see  → ordinary setup state, fixable in a minute
 *   3. class carries no course → ordinary setup state, fixable in a minute
 *
 * Only (1) is a 404. Cases (2) and (3) happen the moment a teacher creates an
 * account and clicks the child's name before assigning a class — the list page
 * links every student it shows, including the ones it labels "chưa xếp lớp".
 * Answering that click with "This page could not be found" sends the teacher
 * hunting for a broken link, when the child is fine and one field is unset.
 *
 * Returns `null` only for case (1), so the caller can still produce a real 404.
 */
export type LyDoChuaXem =
  | { loai: 'chua-xep-lop' }
  | { loai: 'lop-chua-co-khoa-hoc'; lop: string[] };

export interface HocSinhChuaSanSang {
  studentId: string;
  displayName: string;
  username: string;
  isActive: boolean;
  lyDo: LyDoChuaXem;
  /**
   * Classes this actor may actually put the child into.
   *
   * Scoped the same way the provisioning page scopes its picker: an admin sees
   * every open class, a teacher only their own. An affordance, not the
   * boundary — `xepHocSinhVaoLop` re-checks `class:manage` on whatever arrives.
   */
  lopXepDuoc: Array<{ id: string; ten: string; ma: string }>;
}

export async function duLieuHocSinhChuaSanSang(
  actor: Actor,
  studentId: string,
): Promise<HocSinhChuaSanSang | null> {
  // Same relational check as the full loader. A teacher who does not teach this
  // child is refused here too, so the fallback page cannot become a way to
  // confirm that a given id exists.
  await authorize(db, actor, { resource: 'student', action: 'read', studentId });

  const [student, lop] = await Promise.all([
    db.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        displayName: true,
        username: true,
        isActive: true,
        enrollments: {
          where: {
            isActive: true,
            ...(actor.role === 'ADMIN' ? {} : { class: { teacherId: actor.id } }),
          },
          select: {
            class: { select: { name: true, classCourses: { select: { courseId: true } } } },
          },
        },
      },
    }),
    db.class.findMany({
      where:
        actor.role === 'ADMIN'
          ? { isArchived: false }
          : { isArchived: false, teacherId: actor.id },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // A teacher id typed into the student URL is "not found" here, not a partial
  // page about a colleague.
  if (!student || student.role !== 'STUDENT') return null;

  const lyDo: LyDoChuaXem =
    student.enrollments.length === 0
      ? { loai: 'chua-xep-lop' }
      : { loai: 'lop-chua-co-khoa-hoc', lop: student.enrollments.map((e) => e.class.name) };

  return {
    studentId: student.id,
    displayName: student.displayName,
    username: student.username,
    isActive: student.isActive,
    lyDo,
    lopXepDuoc: lop.map((l) => ({ id: l.id, ten: l.name, ma: l.code })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Curriculum viewer — the teacher's read of the lesson plan
// ═══════════════════════════════════════════════════════════════════════════

export interface KhoiGiaoVien {
  blockId: string;
  order: number;
  type: BlockType;
  stage: FlowStage;
  title: string;
  tier: Tier;
  isOptional: boolean;
  estimatedMinutes: number;
  coTracNghiem: boolean;
  coBaiTap: boolean;
}

export interface BaiHocGiaoVien {
  lessonId: string;
  slug: string;
  order: number;
  title: string;
  summary: string;
  objectives: string[];
  status: LessonStatus;
  /** 1–5, a planning aid. Never rendered to a student as a label. */
  difficulty: number;
  estimatedMinutes: number;
  isPublished: boolean;
  isDerived: boolean;
  /** Verbatim from the source lesson plan. Teacher-only. */
  teacherNotes: string | null;
  tienQuyet: Array<{ order: number; title: string }>;
  khoi: KhoiGiaoVien[];
  soKhoiTheoNhanh: Record<Tier, number>;
}

export interface ModuleGiaoVien {
  moduleId: string;
  title: string;
  description: string;
  order: number;
  sessionFrom: number;
  sessionTo: number;
  baiHoc: BaiHocGiaoVien[];
}

export interface DuLieuGiaoTrinh {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  iconEmoji: string;
  totalSessions: number;
  modules: ModuleGiaoVien[];
  soBuoiCoGhiChu: number;
}

export async function duLieuGiaoTrinh(
  actor: Actor,
  courseSlug: string,
): Promise<DuLieuGiaoTrinh | null> {
  // Reading the curriculum with its instructional notes is a staff capability.
  await authorize(db, actor, { resource: 'curriculum', action: 'create' });

  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      iconEmoji: true,
      totalSessions: true,
      modules: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          sessionFrom: true,
          sessionTo: true,
        },
      },
      lessons: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          slug: true,
          order: true,
          title: true,
          summary: true,
          objectives: true,
          status: true,
          difficulty: true,
          estimatedMinutes: true,
          isPublished: true,
          isDerived: true,
          teacherNotes: true,
          moduleId: true,
          prerequisites: {
            select: { required: { select: { order: true, title: true } } },
          },
          blocks: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              type: true,
              title: true,
              tier: true,
              isOptional: true,
              estimatedMinutes: true,
              quizId: true,
              problemId: true,
            },
          },
        },
      },
    },
  });
  if (!course) return null;

  const theoModule = new Map<string, BaiHocGiaoVien[]>();
  let soBuoiCoGhiChu = 0;

  for (const lesson of course.lessons) {
    if (lesson.teacherNotes) soBuoiCoGhiChu += 1;

    const soKhoiTheoNhanh: Record<Tier, number> = {
      CO_BAN: 0,
      THU_THACH: 0,
      NANG_CAO: 0,
      MO_RONG: 0,
    };
    for (const b of lesson.blocks) soKhoiTheoNhanh[b.tier] += 1;

    const row: BaiHocGiaoVien = {
      lessonId: lesson.id,
      slug: lesson.slug,
      order: lesson.order,
      title: lesson.title,
      summary: lesson.summary,
      objectives: lesson.objectives,
      status: lesson.status,
      difficulty: lesson.difficulty,
      estimatedMinutes: lesson.estimatedMinutes,
      isPublished: lesson.isPublished,
      isDerived: lesson.isDerived,
      teacherNotes: lesson.teacherNotes,
      tienQuyet: lesson.prerequisites
        .map((p) => ({ order: p.required.order, title: bocMarkdown(p.required.title) }))
        .sort((a, b) => a.order - b.order),
      khoi: lesson.blocks.map((b) => ({
        blockId: b.id,
        order: b.order,
        type: b.type,
        stage: stageOf(b.type),
        title: b.title,
        tier: b.tier,
        isOptional: b.isOptional,
        estimatedMinutes: b.estimatedMinutes,
        coTracNghiem: b.quizId !== null,
        coBaiTap: b.problemId !== null,
      })),
      soKhoiTheoNhanh,
    };

    const list = theoModule.get(lesson.moduleId);
    if (list) list.push(row);
    else theoModule.set(lesson.moduleId, [row]);
  }

  return {
    courseId: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle ?? '',
    description: course.description,
    iconEmoji: course.iconEmoji,
    totalSessions: course.totalSessions,
    soBuoiCoGhiChu,
    modules: course.modules.map((m) => ({
      moduleId: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      sessionFrom: m.sessionFrom,
      sessionTo: m.sessionTo,
      baiHoc: (theoModule.get(m.id) ?? []).sort((a, b) => a.order - b.order),
    })),
  };
}

/** Courses a staff member can browse. */
export async function danhSachKhoaHoc(): Promise<
  Array<{ slug: string; title: string; iconEmoji: string; totalSessions: number }>
> {
  return db.course.findMany({
    where: { isPublished: true },
    select: { slug: true, title: true, iconEmoji: true, totalSessions: true },
    orderBy: { order: 'asc' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Staff accounts — the deletion flow
// ═══════════════════════════════════════════════════════════════════════════

export interface HangNhanVien {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  soLop: number;
  laToi: boolean;
  /** Names of the classes this person currently runs. */
  tenLop: string[];
}

/** An open class, and who runs it today. */
export interface LopCoTheGiao {
  id: string;
  ten: string;
  ma: string;
  chuId: string;
  chuTen: string;
}

export interface DuLieuNhanVien {
  nhanVien: HangNhanVien[];
  nguoiNhanBanGiao: Array<{ id: string; username: string; displayName: string; role: Role }>;
  /**
   * Every open class with its current holder.
   *
   * `Class.teacherId` is not nullable, so there is no pool of unheld classes to
   * offer — assigning one always takes it from the person named here. The row UI
   * shows that name, because "who is this coming from?" is the question an admin
   * needs answered before they confirm.
   */
  lopDangMo: LopCoTheGiao[];
}

export async function duLieuNhanVien(actor: Actor): Promise<DuLieuNhanVien> {
  if (actor.role !== 'ADMIN') {
    // Not a redirect: the caller decides how to present a refusal.
    return { nhanVien: [], nguoiNhanBanGiao: [], lopDangMo: [] };
  }

  const [staff, keNhiem, lop] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ['TEACHER', 'ADMIN'] } },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        _count: { select: { taughtClasses: true } },
        taughtClasses: {
          where: { isArchived: false },
          select: { name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    }),
    nguoiCoTheNhanBanGiao(db, actor.id),
    db.class.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        code: true,
        teacherId: true,
        teacher: { select: { displayName: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    nhanVien: staff.map((s) => ({
      id: s.id,
      username: s.username,
      displayName: s.displayName,
      role: s.role,
      isActive: s.isActive,
      soLop: s._count.taughtClasses,
      laToi: s.id === actor.id,
      tenLop: s.taughtClasses.map((c) => c.name),
    })),
    nguoiNhanBanGiao: keNhiem,
    lopDangMo: lop.map((l) => ({
      id: l.id,
      ten: l.name,
      ma: l.code,
      chuId: l.teacherId,
      chuTen: l.teacher.displayName,
    })),
  };
}

/** What removing this account would collide with. Admin-only. */
export async function anhHuongXoa(
  actor: Actor,
  targetId: string,
): Promise<AnhHuongXoaTaiKhoan | null> {
  if (actor.role !== 'ADMIN') return null;
  return anhHuongXoaTaiKhoan(db, targetId);
}

// ═══════════════════════════════════════════════════════════════════════════
// Hardware review queue
// ═══════════════════════════════════════════════════════════════════════════

export interface BaiMicrobitChoCham {
  submissionId: string;
  studentId: string;
  tenHocSinh: string;
  problemSlug: string;
  problemTitle: string;
  lessonTitle: string;
  lessonOrder: number;
  attemptNo: number;
  nopLuc: Date;
  daCham: boolean;
  verdict: string;
}

/**
 * Micro:bit submissions waiting for a person.
 *
 * These never reach a verdict on their own: the judge worker SKIPs MAKECODE
 * because a container cannot watch an LED matrix. If this queue is not worked,
 * a student's hardware submission sits unanswered forever — so it is a real
 * queue with a real count, not a filter on a general list.
 */
export async function hangMicrobitChoCham(actor: Actor): Promise<BaiMicrobitChoCham[]> {
  const ids = await visibleStudentIds(db, actor);
  if (ids.length === 0) return [];

  const rows = await db.submission.findMany({
    where: {
      studentId: { in: ids },
      problem: { judgeMode: 'MAKECODE' },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      studentId: true,
      attemptNo: true,
      createdAt: true,
      judgedAt: true,
      verdict: true,
      student: { select: { displayName: true } },
      problem: { select: { slug: true, title: true } },
      lesson: { select: { title: true, order: true } },
    },
  });

  return rows.map((r) => ({
    submissionId: r.id,
    studentId: r.studentId,
    tenHocSinh: r.student.displayName,
    problemSlug: r.problem.slug,
    problemTitle: bocMarkdown(r.problem.title),
    lessonTitle: bocMarkdown(r.lesson?.title ?? ''),
    lessonOrder: r.lesson?.order ?? 0,
    attemptNo: r.attemptNo,
    nopLuc: r.createdAt,
    daCham: r.judgedAt !== null,
    verdict: r.verdict,
  }));
}

export interface BaiMicrobitChiTiet {
  submissionId: string;
  studentId: string;
  tenHocSinh: string;
  problemTitle: string;
  problemStatement: string;
  /** Teacher-only: the reference arrangement, for comparison. */
  loiGiaiMau: string;
  blocksXml: string;
  attemptNo: number;
  nopLuc: Date;
  verdict: string;
  score: number;
  totalPoints: number;
  daCham: boolean;
  nhanXet: Array<{ id: string; comment: string; tenGiaoVien: string; luc: Date }>;
}

/** One hardware submission, with everything a teacher needs to grade it. */
export async function baiMicrobitDeCham(
  actor: Actor,
  submissionId: string,
): Promise<BaiMicrobitChiTiet | null> {
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      code: true,
      blocksXml: true,
      attemptNo: true,
      createdAt: true,
      judgedAt: true,
      verdict: true,
      score: true,
      student: { select: { displayName: true } },
      problem: {
        select: { title: true, statement: true, solutionCode: true, totalPoints: true, judgeMode: true },
      },
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
  if (!sub) return null;

  // The relational check, before any of it is returned.
  await authorize(db, actor, { resource: 'submission', action: 'grade', submissionId });

  if (sub.problem.judgeMode !== 'MAKECODE') return null;

  return {
    submissionId: sub.id,
    studentId: sub.studentId,
    tenHocSinh: sub.student.displayName,
    problemTitle: bocMarkdown(sub.problem.title),
    problemStatement: sub.problem.statement,
    loiGiaiMau: sub.problem.solutionCode,
    // `blocksXml` is the field of record; `code` carries the same bytes for
    // every existing query that does not know about hardware.
    blocksXml: sub.blocksXml ?? sub.code,
    attemptNo: sub.attemptNo,
    nopLuc: sub.createdAt,
    verdict: sub.verdict,
    score: sub.score,
    totalPoints: sub.problem.totalPoints,
    daCham: sub.judgedAt !== null,
    nhanXet: sub.feedback.map((f) => ({
      id: f.id,
      comment: f.comment,
      tenGiaoVien: f.author.displayName,
      luc: f.createdAt,
    })),
  };
}

/** Every student this actor may legitimately reach. Used by search and pickers. */
export async function hocSinhTrongTam(actor: Actor): Promise<string[]> {
  return visibleStudentIds(db, actor);
}

/** One student row on the provisioning page. */
export interface HangTaiKhoanHocSinh {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  /** Class names this student is actively enrolled in. */
  lop: string[];
}

export interface DuLieuTaiKhoanHocSinh {
  hocSinh: HangTaiKhoanHocSinh[];
  lopDangMo: Array<{ id: string; ten: string; ma: string; giaoVien: string }>;
  /** A teacher must place the new account in one of their own classes. */
  batBuocChonLop: boolean;
}

/**
 * The accounts this actor may provision into, and the ones they already have.
 *
 * ── Two different questions, one loader ──────────────────────────────────────
 * An ADMIN sees every student account and every open class, because their
 * question is "which accounts exist?".
 *
 * A TEACHER sees only the children they teach and only the classes they run.
 * That scope is taken from `hocSinhTrongTam` / `Class.teacherId` — the same
 * relationship `taoTaiKhoan` enforces server-side — so the form can never offer
 * a class the action would refuse. The filtering here is an affordance, not the
 * boundary: the boundary is in core, and it holds whatever this returns.
 *
 * The per-student class list is scoped too. Showing a teacher every class a
 * shared student belongs to would name another teacher's class to someone with
 * no relationship to it.
 */
export async function duLieuTaiKhoanHocSinh(actor: Actor): Promise<DuLieuTaiKhoanHocSinh> {
  if (actor.role === 'STUDENT') {
    // Not a redirect: the caller decides how to present a refusal.
    return { hocSinh: [], lopDangMo: [], batBuocChonLop: false };
  }

  const laQuanTri = actor.role === 'ADMIN';
  const trongTam = laQuanTri ? null : await visibleStudentIds(db, actor);

  const [students, classes] = await Promise.all([
    db.user.findMany({
      where: laQuanTri ? { role: 'STUDENT' } : { role: 'STUDENT', id: { in: trongTam ?? [] } },
      select: {
        id: true,
        username: true,
        displayName: true,
        isActive: true,
        mustChangePassword: true,
        enrollments: {
          where: laQuanTri
            ? { isActive: true }
            : { isActive: true, class: { teacherId: actor.id } },
          select: { class: { select: { name: true } } },
        },
      },
      orderBy: { displayName: 'asc' },
    }),
    db.class.findMany({
      where: laQuanTri ? { isArchived: false } : { isArchived: false, teacherId: actor.id },
      select: {
        id: true,
        name: true,
        code: true,
        teacher: { select: { displayName: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    hocSinh: students.map((s) => ({
      id: s.id,
      username: s.username,
      displayName: s.displayName,
      isActive: s.isActive,
      mustChangePassword: s.mustChangePassword,
      lop: s.enrollments.map((e) => e.class.name),
    })),
    lopDangMo: classes.map((c) => ({
      id: c.id,
      ten: c.name,
      ma: c.code,
      giaoVien: c.teacher.displayName,
    })),
    batBuocChonLop: !laQuanTri,
  };
}

/** One class on the class-management page. */
export interface HangLopHoc {
  id: string;
  ten: string;
  ma: string;
  term: string | null;
  giaoVien: string;
  soHocSinh: number;
  daLuuTru: boolean;
}

export interface DuLieuLopHoc {
  lop: HangLopHoc[];
  /** Staff who can be put in charge of a new class. */
  nhanSu: Array<{ id: string; displayName: string; username: string; laToi: boolean }>;
}

/**
 * Classes, for the admin page that creates them.
 *
 * Admin-only. Archived classes are included and flagged rather than hidden: an
 * admin looking for "why can I not reuse that code?" needs to see the class that
 * holds it.
 */
export async function duLieuLopHoc(actor: Actor): Promise<DuLieuLopHoc> {
  if (actor.role !== 'ADMIN') {
    // Not a redirect: the caller decides how to present a refusal.
    return { lop: [], nhanSu: [] };
  }

  const [lop, nhanSu] = await Promise.all([
    db.class.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        term: true,
        isArchived: true,
        teacher: { select: { displayName: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
    }),
    db.user.findMany({
      where: { isActive: true, role: { in: ['TEACHER', 'ADMIN'] } },
      select: { id: true, displayName: true, username: true },
      orderBy: { displayName: 'asc' },
    }),
  ]);

  return {
    lop: lop.map((l) => ({
      id: l.id,
      ten: l.name,
      ma: l.code,
      term: l.term,
      giaoVien: l.teacher.displayName,
      soHocSinh: l._count.enrollments,
      daLuuTru: l.isArchived,
    })),
    nhanSu: nhanSu.map((n) => ({
      id: n.id,
      displayName: n.displayName,
      username: n.username,
      laToi: n.id === actor.id,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Curriculum assignment — the "Gắn khoá học" panel on a class page
// ═══════════════════════════════════════════════════════════════════════════

export interface DuLieuGanKhoaHoc {
  /** Every published course, flagged with whether this class already has it. */
  khoaHoc: KhoaHocChonDuoc[];
  /** False for a teacher looking at a class they do not run. */
  duocSua: boolean;
}

/**
 * What the assign-course panel needs.
 *
 * `duocSua` decides whether the panel renders at all, and it is computed with
 * `can()` — the non-throwing twin of `authorize()` — against exactly the
 * permission the server action will demand. A hidden button is not access
 * control, and the action re-checks; what this prevents is offering a control
 * that would be refused, which reads to a teacher as a broken page.
 */
export async function duLieuGanKhoaHoc(
  actor: Actor,
  classId: string,
): Promise<DuLieuGanKhoaHoc> {
  const duocSua = await can(db, actor, { resource: 'class', action: 'manage', classId });
  if (!duocSua) return { khoaHoc: [], duocSua: false };

  return { khoaHoc: await khoaHocChoLop(db, classId), duocSua: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Focus alerts
// ═══════════════════════════════════════════════════════════════════════════

export interface DuLieuCanhBao {
  canhBao: CanhBaoHienThi[];
  soChuaXuLy: number;
  /** True when this actor is seeing the whole system rather than their classes. */
  toanHeThong: boolean;
  nguong: number;
}

/**
 * The alert feed.
 *
 * Scope comes from `canhBaoTapTrung` in @dye/core, which builds it from
 * `Class.teacherId → Enrollment → student` — the same relationship
 * `authorize()` walks. This function adds no filtering of its own, so the feed
 * and the student detail page cannot disagree about who is visible.
 */
export async function duLieuCanhBao(
  actor: Actor,
  options: { chiChuaXuLy?: boolean } = {},
): Promise<DuLieuCanhBao> {
  const [canhBao, soChuaXuLy] = await Promise.all([
    canhBaoTapTrung(db, actor, {
      ...(options.chiChuaXuLy ? { chiChuaXuLy: true } : {}),
      gioiHan: 200,
    }),
    soCanhBaoChuaXuLy(db, actor),
  ]);

  return {
    canhBao,
    soChuaXuLy,
    toanHeThong: actor.role === 'ADMIN',
    nguong: NGUONG_CANH_BAO,
  };
}

/** Open-alert count for the nav badge. Never throws — a badge must not 500 a page. */
export async function demCanhBaoChuaXuLy(actor: Actor): Promise<number> {
  try {
    return await soCanhBaoChuaXuLy(db, actor);
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Class analytics, scoped to what this actor may see.
 *
 * A thin pass-through to `thongKeGiangDay`, and deliberately thin: the moment
 * this file started assembling its own aggregates, the teacher/admin scope rule
 * would exist in two places. It exists in exactly one, in @dye/core, where the
 * integration tests can reach it without a web server.
 */
export async function duLieuThongKe(
  actor: Actor,
  options: { classId?: string | undefined; keCaLuuTru?: boolean | undefined } = {},
): Promise<ThongKeTongQuan> {
  return thongKeGiangDay(db, actor, options);
}

/** One student's focus history, for their teacher's detail page. */
export async function duLieuTapTrungHocSinh(
  actor: Actor,
  studentId: string,
): Promise<TomTatTapTrung | null> {
  // The same guard the rest of the student detail page runs. A teacher who does
  // not teach this child is refused here, before a single event row is read.
  const duocXem = await can(db, actor, { resource: 'student', action: 'read', studentId });
  if (!duocXem) return null;

  return tomTatTapTrung(db, studentId);
}
