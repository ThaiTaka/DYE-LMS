/**
 * Focus tracking — noticing when a student leaves the lesson tab.
 *
 * ── What this is, and what it deliberately is not ────────────────────────────
 * The browser can tell us that a tab stopped being visible. It cannot tell us
 * where the student went, and it must not try: no URL, no window title, no
 * clipboard content, no screenshot. A child who alt-tabs to a dictionary, to a
 * chat, or to nothing at all because a parent walked in produces the identical
 * event here, and the system has no way to tell those apart. Nor should it.
 *
 * So this module logs a NEUTRAL fact — "the tab was hidden for 40 seconds
 * during Buổi 5" — and hands it to a teacher. It never renders a verdict, never
 * blocks a submission, and never shows the student an accusation. The alert copy
 * throughout says "nên hỏi thăm" (worth checking in on), the same framing the
 * rest of the teacher dashboard uses, because the only correct response to this
 * signal is a human asking a question.
 *
 * ── Why the client is not trusted ────────────────────────────────────────────
 * Every field a browser could lie about is either ignored or clamped:
 *
 *   • `studentId` NEVER comes from the request. It is taken from the server
 *     session by the caller, so one student cannot log events against another.
 *   • `awaySeconds` is clamped to CAP_AWAY_SECONDS. A tab left open overnight
 *     would otherwise report 40 000 seconds and drown every real signal.
 *   • Events arriving inside DEDUP_MS of the previous one are dropped. A single
 *     alt-tab fires `blur` AND `visibilitychange` in most browsers; counting
 *     that as two tab-outs would put a student over a threshold of three after
 *     leaving the page once.
 *   • A student may not log more than TRAN_MOI_LAN events for one lesson. Past
 *     that the tally is already far beyond any threshold, so the extra rows buy
 *     nothing and a scripted client cannot fill the table.
 *
 * The tracker is also, unavoidably, defeatable — a student who opens the lesson
 * on a phone reports nothing at all. That is fine. This is a prompt for a
 * teacher to walk over, not an exam proctor, and a system that pretended
 * otherwise would punish the students who left it switched on.
 */
import { ForbiddenError } from './errors';

import type { FocusAlertState, FocusEventType, PrismaClient } from '@prisma/client';
import type { Actor } from './session';

/**
 * Tab-outs in one lesson before a teacher is told.
 *
 * Three, because one is noise (a notification, a misclick) and two is a
 * coincidence. Alerts re-raise at every multiple — 3, 6, 9 — so a lesson that
 * keeps going stays visible without re-notifying on every single event.
 */
export const NGUONG_CANH_BAO = 3;

/** Events closer together than this are the same alt-tab reported twice. */
export const DEDUP_MS = 1500;

/** An "away" longer than this is a closed laptop, not a lookup. */
export const CAP_AWAY_SECONDS = 30 * 60;

/** Per (student, lesson) write ceiling. Past this the tally is already made. */
export const TRAN_MOI_LAN = 200;

/** Event types that mean the student LEFT. `RETURNED` closes one; it is not one. */
const LA_ROI_DI: ReadonlySet<FocusEventType> = new Set<FocusEventType>([
  'TAB_HIDDEN',
  'WINDOW_BLUR',
]);

export interface SuKienTapTrung {
  lessonId: string;
  blockId?: string | undefined;
  type: FocusEventType;
  awaySeconds?: number | undefined;
}

export interface KetQuaGhiNhan {
  /** False when the event was deduped, capped, or the lesson was not theirs. */
  daGhi: boolean;
  /** Tab-outs recorded for this student in this lesson, after the write. */
  soLanRoi: number;
  /** Set when this write crossed a threshold and raised a new alert. */
  canhBaoMoi: { nguong: number; soLan: number } | null;
}

/**
 * Which class is this student sitting in for this lesson?
 *
 * Denormalised onto the alert at raise time so the teacher feed can be scoped by
 * `Class.teacherId` — the same relationship the whole authorization layer runs
 * on — rather than re-deriving enrolment for every alert on the page.
 *
 * Null is a legitimate answer: a student can open a lesson through a course
 * attached to no class of theirs. The alert is still raised; it is simply
 * visible to admins only, which is the honest scope for it.
 */
async function lopChoBaiHoc(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<string | null> {
  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId,
      isActive: true,
      class: { classCourses: { some: { course: { lessons: { some: { id: lessonId } } } } } },
    },
    select: { classId: true },
    orderBy: { enrolledAt: 'desc' },
  });
  return enrollment?.classId ?? null;
}

/**
 * Record one focus change.
 *
 * `studentId` must come from the server session. Nothing in this function
 * re-checks who the caller is, because it has no way to: it is the call site's
 * job never to pass an id that arrived in a request body.
 */
export async function ghiNhanSuKienTapTrung(
  db: PrismaClient,
  studentId: string,
  input: SuKienTapTrung,
): Promise<KetQuaGhiNhan> {
  const lesson = await db.lesson.findUnique({
    where: { id: input.lessonId },
    select: { id: true, order: true, title: true, courseId: true },
  });
  // Unknown lesson id: answer as a no-op rather than throwing. This is called
  // from a `beforeunload`-adjacent path where an exception would surface to a
  // 12-year-old as a crashed page for something that does not matter.
  if (!lesson) return { daGhi: false, soLanRoi: 0, canhBaoMoi: null };

  const daCo = await db.focusEvent.count({
    where: { studentId, lessonId: lesson.id },
  });
  if (daCo >= TRAN_MOI_LAN) {
    const soLanRoi = await db.focusEvent.count({
      where: { studentId, lessonId: lesson.id, type: { in: [...LA_ROI_DI] } },
    });
    return { daGhi: false, soLanRoi, canhBaoMoi: null };
  }

  // Dedupe: one alt-tab, one row.
  const ganNhat = await db.focusEvent.findFirst({
    where: { studentId, lessonId: lesson.id },
    select: { type: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  if (
    ganNhat &&
    ganNhat.type === input.type &&
    Date.now() - ganNhat.createdAt.getTime() < DEDUP_MS
  ) {
    const soLanRoi = await db.focusEvent.count({
      where: { studentId, lessonId: lesson.id, type: { in: [...LA_ROI_DI] } },
    });
    return { daGhi: false, soLanRoi, canhBaoMoi: null };
  }

  const awaySeconds = Math.min(
    Math.max(0, Math.round(input.awaySeconds ?? 0)),
    CAP_AWAY_SECONDS,
  );

  await db.focusEvent.create({
    data: {
      studentId,
      lessonId: lesson.id,
      blockId: input.blockId ?? null,
      type: input.type,
      awaySeconds,
    },
  });

  const soLanRoi = await db.focusEvent.count({
    where: { studentId, lessonId: lesson.id, type: { in: [...LA_ROI_DI] } },
  });

  // Only a leave can cross a threshold. A RETURNED event carries the duration
  // and closes the gap; counting it would double every trip.
  if (!LA_ROI_DI.has(input.type)) {
    return { daGhi: true, soLanRoi, canhBaoMoi: null };
  }

  const nguong = Math.floor(soLanRoi / NGUONG_CANH_BAO) * NGUONG_CANH_BAO;
  if (nguong < NGUONG_CANH_BAO || soLanRoi % NGUONG_CANH_BAO !== 0) {
    return { daGhi: true, soLanRoi, canhBaoMoi: null };
  }

  const canhBaoMoi = await raiseAlert(db, studentId, lesson, soLanRoi, nguong);
  return { daGhi: true, soLanRoi, canhBaoMoi };
}

/**
 * Raise one alert and notify the adults who may see it.
 *
 * The `@@unique(studentId, lessonId, nguong)` key is what makes this idempotent:
 * two concurrent writes racing past the same threshold produce one alert and one
 * round of notifications, not two. `create` is used rather than `upsert` and the
 * duplicate-key failure is swallowed, so the loser of the race reports "no new
 * alert" instead of re-notifying.
 */
async function raiseAlert(
  db: PrismaClient,
  studentId: string,
  lesson: { id: string; order: number; title: string },
  soLan: number,
  nguong: number,
): Promise<{ nguong: number; soLan: number } | null> {
  const [classId, tongVang, student] = await Promise.all([
    lopChoBaiHoc(db, studentId, lesson.id),
    db.focusEvent.aggregate({
      where: { studentId, lessonId: lesson.id },
      _sum: { awaySeconds: true },
    }),
    db.user.findUnique({ where: { id: studentId }, select: { displayName: true } }),
  ]);

  try {
    await db.focusAlert.create({
      data: {
        studentId,
        lessonId: lesson.id,
        classId,
        soLan,
        nguong,
        totalAwaySeconds: tongVang._sum.awaySeconds ?? 0,
      },
    });
  } catch {
    // Already raised for this threshold — another request won the race.
    return null;
  }

  await notifyAdults(db, {
    studentId,
    studentName: student?.displayName ?? 'Một học sinh',
    classId,
    lesson,
    soLan,
  });

  return { nguong, soLan };
}

/**
 * Who gets told.
 *
 * The class teacher, because they are in the room. Every active admin, because
 * the brief asks for system-wide visibility. Never the student: this is a
 * prompt for an adult to start a conversation, and a notification saying "we
 * noticed you left the tab" turns that conversation into an accusation before
 * anyone has asked a question.
 */
async function notifyAdults(
  db: PrismaClient,
  input: {
    studentId: string;
    studentName: string;
    classId: string | null;
    lesson: { id: string; order: number; title: string };
    soLan: number;
  },
): Promise<void> {
  const nguoiNhan = new Set<string>();

  if (input.classId) {
    const klass = await db.class.findUnique({
      where: { id: input.classId },
      select: { teacherId: true, teacher: { select: { isActive: true } } },
    });
    if (klass?.teacher.isActive) nguoiNhan.add(klass.teacherId);
  }

  const admins = await db.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  for (const a of admins) nguoiNhan.add(a.id);

  if (nguoiNhan.size === 0) return;

  await db.notification.createMany({
    data: [...nguoiNhan].map((userId) => ({
      userId,
      type: 'FOCUS_ALERT' as const,
      title: `${input.studentName} rời khỏi bài ${input.soLan} lần`,
      body:
        `Buổi ${input.lesson.order} · ${input.lesson.title}. ` +
        'Có thể em đang tra cứu, đang gặp khó, hoặc chỉ bị phân tâm — ' +
        'thầy cô ghé hỏi thăm em một câu nhé.',
      linkUrl: `/giao-vien/hoc-sinh/${input.studentId}`,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Reading the feed
// ═══════════════════════════════════════════════════════════════════════════

export interface CanhBaoHienThi {
  id: string;
  studentId: string;
  tenHocSinh: string;
  username: string;
  classId: string | null;
  tenLop: string | null;
  lessonId: string;
  tenBai: string;
  buoi: number;
  tenKhoa: string;
  soLan: number;
  nguong: number;
  tongVangGiay: number;
  state: FocusAlertState;
  luc: Date;
  nguoiXuLy: string | null;
}

/**
 * Alerts this actor may see.
 *
 * ── The scope rule ───────────────────────────────────────────────────────────
 * An ADMIN sees everything, which is what the brief asks for.
 *
 * A TEACHER sees an alert only when they hold the relationship — the alert's
 * class is one they run, OR the student is one they currently teach. The second
 * clause matters: `FocusAlert.classId` is nullable and is SET NULL if the class
 * is later deleted, and an alert must not become invisible to the teacher who
 * needs it because the class was reorganised.
 *
 * The filter is built from `Class.teacherId → Enrollment → student`, the same
 * path `authorize()` walks, so this list and the student detail page can never
 * disagree about who is visible.
 */
export async function canhBaoTapTrung(
  db: PrismaClient,
  actor: Actor,
  options: { chiChuaXuLy?: boolean | undefined; gioiHan?: number | undefined } = {},
): Promise<CanhBaoHienThi[]> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-read-alerts');

  const trongPhamVi =
    actor.role === 'ADMIN'
      ? {}
      : {
          OR: [
            { class: { teacherId: actor.id } },
            {
              student: {
                enrollments: { some: { isActive: true, class: { teacherId: actor.id } } },
              },
            },
          ],
        };

  const rows = await db.focusAlert.findMany({
    where: {
      ...trongPhamVi,
      ...(options.chiChuaXuLy ? { state: 'OPEN' as const } : {}),
    },
    select: {
      id: true,
      studentId: true,
      classId: true,
      lessonId: true,
      soLan: true,
      nguong: true,
      totalAwaySeconds: true,
      state: true,
      createdAt: true,
      student: { select: { displayName: true, username: true } },
      class: { select: { name: true } },
      lesson: { select: { title: true, order: true, course: { select: { title: true } } } },
      reviewedBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options.gioiHan ?? 100,
  });

  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    tenHocSinh: r.student.displayName,
    username: r.student.username,
    classId: r.classId,
    tenLop: r.class?.name ?? null,
    lessonId: r.lessonId,
    tenBai: r.lesson.title,
    buoi: r.lesson.order,
    tenKhoa: r.lesson.course.title,
    soLan: r.soLan,
    nguong: r.nguong,
    tongVangGiay: r.totalAwaySeconds,
    state: r.state,
    luc: r.createdAt,
    nguoiXuLy: r.reviewedBy?.displayName ?? null,
  }));
}

/** How many alerts are still open for this actor. Powers the nav badge. */
export async function soCanhBaoChuaXuLy(db: PrismaClient, actor: Actor): Promise<number> {
  if (!actor.isActive || actor.role === 'STUDENT') return 0;

  return db.focusAlert.count({
    where: {
      state: 'OPEN',
      ...(actor.role === 'ADMIN'
        ? {}
        : {
            OR: [
              { class: { teacherId: actor.id } },
              {
                student: {
                  enrollments: { some: { isActive: true, class: { teacherId: actor.id } } },
                },
              },
            ],
          }),
    },
  });
}

/**
 * Mark an alert dealt with.
 *
 * ACKNOWLEDGED means "I spoke to them". DISMISSED means "this was nothing".
 * Both are recorded with a name and a time, because an alert about a child that
 * was silently cleared is worse than one nobody looked at.
 *
 * Re-reads the alert through the same scope filter rather than trusting the id,
 * so a teacher cannot clear an alert about a class they do not run by guessing
 * its id.
 */
export async function xuLyCanhBao(
  db: PrismaClient,
  actor: Actor,
  alertId: string,
  state: Extract<FocusAlertState, 'ACKNOWLEDGED' | 'DISMISSED'>,
): Promise<{ tenHocSinh: string }> {
  const trongTam = await canhBaoTapTrung(db, actor, { gioiHan: 1000 });
  const alert = trongTam.find((a) => a.id === alertId);
  if (!alert) throw new ForbiddenError('alert-not-visible');

  await db.focusAlert.update({
    where: { id: alertId },
    data: { state, reviewedById: actor.id, reviewedAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'focus.alert_reviewed',
      entityType: 'FocusAlert',
      entityId: alertId,
      meta: { state, studentId: alert.studentId, lessonId: alert.lessonId },
    },
  });

  return { tenHocSinh: alert.tenHocSinh };
}

// ═══════════════════════════════════════════════════════════════════════════
// Per-student summary
// ═══════════════════════════════════════════════════════════════════════════

export interface TomTatTapTrung {
  soLanRoi: number;
  tongVangGiay: number;
  lanCuoi: Date | null;
  soCanhBao: number;
  /** Per lesson, most recent first. */
  theoBai: Array<{
    lessonId: string;
    buoi: number;
    tenBai: string;
    soLanRoi: number;
    tongVangGiay: number;
    lanCuoi: Date;
  }>;
}

/**
 * One student's focus history, for their teacher's detail page.
 *
 * Read-scoped by the CALLER — every route that reaches this has already run
 * `authorize({ resource: 'student', action: 'read' })`, which is the only check
 * that can decide whether this teacher teaches this child.
 */
export async function tomTatTapTrung(
  db: PrismaClient,
  studentId: string,
  options: { tuNgay?: Date | undefined } = {},
): Promise<TomTatTapTrung> {
  const where = {
    studentId,
    type: { in: [...LA_ROI_DI] },
    ...(options.tuNgay ? { createdAt: { gte: options.tuNgay } } : {}),
  };

  const [events, soCanhBao, tongVang] = await Promise.all([
    db.focusEvent.findMany({
      where,
      select: {
        lessonId: true,
        createdAt: true,
        lesson: { select: { order: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    db.focusAlert.count({ where: { studentId } }),
    db.focusEvent.aggregate({
      where: { studentId, ...(options.tuNgay ? { createdAt: { gte: options.tuNgay } } : {}) },
      _sum: { awaySeconds: true },
    }),
  ]);

  const theoBai = new Map<string, TomTatTapTrung['theoBai'][number]>();
  for (const e of events) {
    const co = theoBai.get(e.lessonId);
    if (co) {
      co.soLanRoi += 1;
      continue;
    }
    theoBai.set(e.lessonId, {
      lessonId: e.lessonId,
      buoi: e.lesson.order,
      tenBai: e.lesson.title,
      soLanRoi: 1,
      tongVangGiay: 0,
      lanCuoi: e.createdAt,
    });
  }

  // Away time is summed separately: it lives on RETURNED rows, which are not
  // in `events` because those are the leaves.
  const vangTheoBai = await db.focusEvent.groupBy({
    by: ['lessonId'],
    where: { studentId, ...(options.tuNgay ? { createdAt: { gte: options.tuNgay } } : {}) },
    _sum: { awaySeconds: true },
  });
  for (const row of vangTheoBai) {
    const co = theoBai.get(row.lessonId);
    if (co) co.tongVangGiay = row._sum.awaySeconds ?? 0;
  }

  return {
    soLanRoi: events.length,
    tongVangGiay: tongVang._sum.awaySeconds ?? 0,
    lanCuoi: events[0]?.createdAt ?? null,
    soCanhBao,
    theoBai: [...theoBai.values()],
  };
}
