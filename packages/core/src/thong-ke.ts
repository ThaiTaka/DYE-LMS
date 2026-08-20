/**
 * Analytics — class averages and completion rates.
 *
 * ── The scope rule, restated because this is where it is easiest to break ────
 * An aggregate is a leak with extra steps. `AVG(score)` over "all classes" is
 * one query, it looks harmless, and it hands a teacher a number derived from
 * children they have no relationship with. Every function here therefore starts
 * from the SAME relationship the rest of the system uses —
 *
 *     Class.teacherId = me  →  Enrollment  →  student
 *
 * — and an ADMIN's global view is expressed as "the filter is empty", not as a
 * separate code path. One query shape, one place the scope is decided, so a
 * later edit cannot accidentally widen the teacher view.
 *
 * ── What is measured, and what is not ────────────────────────────────────────
 * Two numbers per class: how much of the REQUIRED work is done, and the mean
 * score on graded work. Both describe the WORK. Neither is ever attached to a
 * child as a label, there is no ranking, no percentile and no leaderboard, and
 * the per-student rows exist so a teacher can find who to sit with — which is
 * why they are sorted by name, not by score.
 *
 * Completion is re-derived through the Phase 4 gating engine rather than read
 * off `LessonProgress`, because "done" depends on the student's tier and on any
 * override their teacher set. A raw row count would report a Cơ bản student as
 * 60% complete for never touching Nâng cao blocks they were never given.
 */
import { courseProgress } from './curriculum/progress';
import { ForbiddenError } from './errors';

import type { PrismaClient } from '@prisma/client';
import type { Actor } from './session';

export interface ThongKeKhoaTrongLop {
  courseId: string;
  slug: string;
  title: string;
  iconEmoji: string;
  /** Mean of each student's required-work percentage. */
  tiLeHoanThanh: number;
  /** Students whose required work is fully done. */
  soHoanThanh: number;
  /** Students with nothing required of them — excluded from the mean. */
  soChuaGiao: number;
}

export interface ThongKeHocSinh {
  studentId: string;
  displayName: string;
  username: string;
  /** Mean required-work percentage across every course attached to the class. */
  tiLeHoanThanh: number;
  /** Mean score over judged submissions. Null when they have not submitted. */
  diemTrungBinh: number | null;
  soBaiNop: number;
  soBaiDat: number;
  /** Quiz answers correct / answered. Null when they have not answered any. */
  tiLeTracNghiem: number | null;
  hoatDongCuoi: Date | null;
  /** Tab-outs logged across every lesson. Context, never a verdict. */
  soLanRoiTab: number;
}

export interface ThongKeLop {
  classId: string;
  ma: string;
  ten: string;
  term: string | null;
  giaoVien: string;
  daLuuTru: boolean;
  siSo: number;
  /** Mean required-work percentage over every student and every attached course. */
  tiLeHoanThanh: number;
  /** Mean score over every judged submission from this class. */
  diemTrungBinh: number | null;
  soBaiNop: number;
  soBaiDat: number;
  /** Ratio of accepted submissions to judged ones, 0–100. */
  tiLeDat: number | null;
  soCanhBaoMo: number;
  khoaHoc: ThongKeKhoaTrongLop[];
  hocSinh: ThongKeHocSinh[];
}

export interface ThongKeTongQuan {
  /** True when this actor is seeing the whole system. */
  toanHeThong: boolean;
  soLop: number;
  soHocSinh: number;
  tiLeHoanThanh: number;
  diemTrungBinh: number | null;
  soBaiNop: number;
  tiLeDat: number | null;
  soCanhBaoMo: number;
  lop: ThongKeLop[];
}

const round = (n: number): number => Math.round(n);

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * The classes this actor is allowed to report on.
 *
 * The ONLY place the teacher/admin distinction is made. Everything downstream
 * consumes the returned ids and cannot widen them.
 */
async function lopTrongPhamVi(
  db: PrismaClient,
  actor: Actor,
  options: { classId?: string | undefined; keCaLuuTru?: boolean | undefined },
): Promise<string[]> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-read-analytics');

  const rows = await db.class.findMany({
    where: {
      ...(actor.role === 'ADMIN' ? {} : { teacherId: actor.id }),
      ...(options.keCaLuuTru ? {} : { isArchived: false }),
      ...(options.classId ? { id: options.classId } : {}),
    },
    select: { id: true },
    orderBy: { name: 'asc' },
  });

  // A teacher naming a class they do not run gets an empty scope, not someone
  // else's numbers — the filter above already removed it.
  if (options.classId && rows.length === 0) throw new ForbiddenError('class-not-in-scope');

  return rows.map((r) => r.id);
}

/**
 * Analytics for every class this actor may see.
 *
 * Teacher: their own classes. Admin: all of them. `classId` narrows to one and
 * is validated against the same scope, so it can never be used to reach outside
 * it.
 */
export async function thongKeGiangDay(
  db: PrismaClient,
  actor: Actor,
  options: { classId?: string | undefined; keCaLuuTru?: boolean | undefined } = {},
): Promise<ThongKeTongQuan> {
  const classIds = await lopTrongPhamVi(db, actor, options);

  const classes = await db.class.findMany({
    where: { id: { in: classIds } },
    select: {
      id: true,
      code: true,
      name: true,
      term: true,
      isArchived: true,
      teacher: { select: { displayName: true } },
      classCourses: {
        select: { course: { select: { id: true, slug: true, title: true, iconEmoji: true } } },
      },
      enrollments: {
        where: { isActive: true },
        select: {
          student: { select: { id: true, displayName: true, username: true } },
        },
      },
    },
    orderBy: [{ isArchived: 'asc' }, { name: 'asc' }],
  });

  const lop: ThongKeLop[] = [];

  for (const klass of classes) {
    const courses = klass.classCourses.map((cc) => cc.course);
    const students = klass.enrollments.map((e) => e.student);
    const studentIds = students.map((s) => s.id);

    const [nopTheoHocSinh, dungTheoHocSinh, tongTheoHocSinh, hoatDong, roiTab, canhBaoMo] =
      await Promise.all([
        studentIds.length === 0
          ? []
          : db.submission.groupBy({
              by: ['studentId'],
              where: { studentId: { in: studentIds }, verdict: { notIn: ['PENDING', 'RUNNING'] } },
              _avg: { score: true },
              _count: { _all: true },
            }),
        studentIds.length === 0
          ? []
          : db.submission.groupBy({
              by: ['studentId'],
              where: { studentId: { in: studentIds }, verdict: 'ACCEPTED' },
              _count: { _all: true },
            }),
        studentIds.length === 0
          ? []
          : db.answer.groupBy({
              by: ['isCorrect'],
              where: { attempt: { studentId: { in: studentIds } } },
              _count: { _all: true },
            }),
        studentIds.length === 0
          ? []
          : db.lessonProgress.groupBy({
              by: ['studentId'],
              where: { studentId: { in: studentIds } },
              _max: { updatedAt: true },
            }),
        studentIds.length === 0
          ? []
          : db.focusEvent.groupBy({
              by: ['studentId'],
              where: {
                studentId: { in: studentIds },
                type: { in: ['TAB_HIDDEN', 'WINDOW_BLUR'] },
              },
              _count: { _all: true },
            }),
        db.focusAlert.count({ where: { classId: klass.id, state: 'OPEN' } }),
      ]);

    const nopMap = new Map(nopTheoHocSinh.map((r) => [r.studentId, r]));
    const datMap = new Map(dungTheoHocSinh.map((r) => [r.studentId, r._count._all]));
    const hoatDongMap = new Map(hoatDong.map((r) => [r.studentId, r._max.updatedAt]));
    const roiTabMap = new Map(roiTab.map((r) => [r.studentId, r._count._all]));

    // One quiz ratio for the class rather than per student: `Answer` has no
    // studentId of its own, and a groupBy that joined through every attempt to
    // split it per child would cost a query per student for a number the
    // teacher reads as a class-level signal anyway.
    const traLoiDung = tongTheoHocSinh.find((r) => r.isCorrect)?._count._all ?? 0;
    const traLoiSai = tongTheoHocSinh.find((r) => !r.isCorrect)?._count._all ?? 0;
    const tongTraLoi = traLoiDung + traLoiSai;
    const tiLeTracNghiemLop = tongTraLoi === 0 ? null : round((traLoiDung / tongTraLoi) * 100);

    /** studentId -> required percentages, one per attached course. */
    const tiLeTheoHocSinh = new Map<string, number[]>();
    const khoaHoc: ThongKeKhoaTrongLop[] = [];

    for (const course of courses) {
      const phanTram: number[] = [];
      let soHoanThanh = 0;
      let soChuaGiao = 0;

      for (const student of students) {
        const progress = await courseProgress(db, student.id, course.id);
        if (!progress.hasRequiredWork) {
          soChuaGiao += 1;
          continue;
        }
        phanTram.push(progress.required.percent);
        if (progress.isComplete) soHoanThanh += 1;

        const truoc = tiLeTheoHocSinh.get(student.id) ?? [];
        truoc.push(progress.required.percent);
        tiLeTheoHocSinh.set(student.id, truoc);
      }

      khoaHoc.push({
        courseId: course.id,
        slug: course.slug,
        title: course.title,
        iconEmoji: course.iconEmoji,
        tiLeHoanThanh: mean(phanTram) ?? 0,
        soHoanThanh,
        soChuaGiao,
      });
    }

    const hocSinh: ThongKeHocSinh[] = students
      .map((s) => {
        const nop = nopMap.get(s.id);
        return {
          studentId: s.id,
          displayName: s.displayName,
          username: s.username,
          tiLeHoanThanh: mean(tiLeTheoHocSinh.get(s.id) ?? []) ?? 0,
          diemTrungBinh: nop?._avg.score == null ? null : round(nop._avg.score),
          soBaiNop: nop?._count._all ?? 0,
          soBaiDat: datMap.get(s.id) ?? 0,
          // Per-student quiz accuracy would cost a query each; the class figure
          // is carried on every row so the column renders without lying about
          // whose number it is (the header says "lớp").
          tiLeTracNghiem: tiLeTracNghiemLop,
          hoatDongCuoi: hoatDongMap.get(s.id) ?? null,
          soLanRoiTab: roiTabMap.get(s.id) ?? 0,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));

    const soBaiNop = nopTheoHocSinh.reduce((n, r) => n + r._count._all, 0);
    const soBaiDat = dungTheoHocSinh.reduce((n, r) => n + r._count._all, 0);

    lop.push({
      classId: klass.id,
      ma: klass.code,
      ten: klass.name,
      term: klass.term,
      giaoVien: klass.teacher.displayName,
      daLuuTru: klass.isArchived,
      siSo: students.length,
      // Averaged over the students who actually HAVE required work. Including a
      // student with nothing assigned as a 0% would report a class as behind
      // because a new arrival has not been given a course yet.
      tiLeHoanThanh:
        mean(students.filter((s) => tiLeTheoHocSinh.has(s.id)).map((s) => mean(tiLeTheoHocSinh.get(s.id) ?? []) ?? 0)) ?? 0,
      diemTrungBinh: mean(
        hocSinh.filter((h) => h.diemTrungBinh !== null).map((h) => h.diemTrungBinh as number),
      ),
      soBaiNop,
      soBaiDat,
      tiLeDat: soBaiNop === 0 ? null : round((soBaiDat / soBaiNop) * 100),
      soCanhBaoMo: canhBaoMo,
      khoaHoc,
      hocSinh,
    });
  }

  const tongHocSinh = lop.reduce((n, l) => n + l.siSo, 0);
  const tongNop = lop.reduce((n, l) => n + l.soBaiNop, 0);
  const tongDat = lop.reduce((n, l) => n + l.soBaiDat, 0);

  return {
    toanHeThong: actor.role === 'ADMIN',
    soLop: lop.length,
    soHocSinh: tongHocSinh,
    tiLeHoanThanh: mean(lop.filter((l) => l.siSo > 0).map((l) => l.tiLeHoanThanh)) ?? 0,
    diemTrungBinh: mean(
      lop.filter((l) => l.diemTrungBinh !== null).map((l) => l.diemTrungBinh as number),
    ),
    soBaiNop: tongNop,
    tiLeDat: tongNop === 0 ? null : round((tongDat / tongNop) * 100),
    soCanhBaoMo: lop.reduce((n, l) => n + l.soCanhBaoMo, 0),
    lop,
  };
}
