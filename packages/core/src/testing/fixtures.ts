/**
 * Isolated fixtures for the authorization tests.
 *
 * Deliberately NOT reusing the demo seed data. In the seed, every student of
 * `thay.minh` is also a student of `co.lan`, so "teacher A cannot reach teacher
 * B's student" would have no true negative case to assert on. These fixtures
 * build two genuinely disjoint teacher→student worlds.
 *
 * Every row is prefixed with a per-run id so concurrent runs cannot collide,
 * and `cleanup()` removes exactly what it created.
 */
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../password';

export const TEST_PASSWORD = 'PhaseBaTest#2026';

export interface Fixture {
  db: PrismaClient;
  prefix: string;
  passwordHash: string;

  /** Teacher A — owns classA, teaches studentA1 and studentA2. */
  teacherA: string;
  /** Teacher B — owns classB, teaches studentB1. Disjoint from teacher A. */
  teacherB: string;
  admin: string;

  studentA1: string;
  studentA2: string;
  studentB1: string;
  /** Enrolled in classA but with isActive = false. */
  studentWithdrawn: string;

  classA: string;
  classB: string;

  courseId: string;
  lessonId: string;
  problemId: string;

  /** Submission owned by studentA1. */
  submissionA1: string;
  /** Submission owned by studentB1. */
  submissionB1: string;

  cleanup: () => Promise<void>;
}

export function makeClient(): PrismaClient {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_URL chưa được đặt.\n' +
        'Các test này chạy trên PostgreSQL thật. Khởi động bằng:\n' +
        '  docker compose up -d postgres',
    );
  }
  return new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
}

export async function createFixture(): Promise<Fixture> {
  const db = makeClient();
  const prefix = `t3-${randomBytes(4).toString('hex')}`;
  const passwordHash = await hashPassword(TEST_PASSWORD);

  const mkUser = async (
    suffix: string,
    role: 'ADMIN' | 'TEACHER' | 'STUDENT',
  ): Promise<string> => {
    const row = await db.user.create({
      data: {
        username: `${prefix}-${suffix}`,
        displayName: `${prefix} ${suffix}`,
        role,
        passwordHash,
        isActive: true,
      },
      select: { id: true },
    });
    return row.id;
  };

  const teacherA = await mkUser('teacher-a', 'TEACHER');
  const teacherB = await mkUser('teacher-b', 'TEACHER');
  const admin = await mkUser('admin', 'ADMIN');
  const studentA1 = await mkUser('student-a1', 'STUDENT');
  const studentA2 = await mkUser('student-a2', 'STUDENT');
  const studentB1 = await mkUser('student-b1', 'STUDENT');
  const studentWithdrawn = await mkUser('student-withdrawn', 'STUDENT');

  const classA = (
    await db.class.create({
      data: { code: `${prefix}-CLASS-A`, name: `${prefix} Lớp A`, teacherId: teacherA },
      select: { id: true },
    })
  ).id;

  const classB = (
    await db.class.create({
      data: { code: `${prefix}-CLASS-B`, name: `${prefix} Lớp B`, teacherId: teacherB },
      select: { id: true },
    })
  ).id;

  await db.enrollment.createMany({
    data: [
      { classId: classA, studentId: studentA1, isActive: true },
      { classId: classA, studentId: studentA2, isActive: true },
      { classId: classB, studentId: studentB1, isActive: true },
      // Left the class: the relationship is over, so access should be too.
      { classId: classA, studentId: studentWithdrawn, isActive: false },
    ],
  });

  // Reuse the seeded curriculum rather than inventing a parallel one.
  const course = await db.course.findUniqueOrThrow({
    where: { slug: 'python-co-ban' },
    select: { id: true },
  });

  // Attach the course to both classes. Without this the gating engine sees no
  // enrolment for the course and locks every lesson — correct behaviour, but it
  // would make the curriculum tests assert on the wrong thing.
  await db.classCourse.createMany({
    data: [
      { classId: classA, courseId: course.id },
      { classId: classB, courseId: course.id },
    ],
    skipDuplicates: true,
  });

  const lesson = await db.lesson.findFirstOrThrow({
    where: { courseId: course.id, order: 1 },
    select: { id: true },
  });
  const problem = await db.problem.findFirstOrThrow({
    where: { judgeMode: 'IO_MATCH' },
    select: { id: true },
  });

  const submissionA1 = (
    await db.submission.create({
      data: { studentId: studentA1, problemId: problem.id, code: '# a1', verdict: 'ACCEPTED' },
      select: { id: true },
    })
  ).id;

  const submissionB1 = (
    await db.submission.create({
      data: { studentId: studentB1, problemId: problem.id, code: '# b1', verdict: 'ACCEPTED' },
      select: { id: true },
    })
  ).id;

  const userIds = [teacherA, teacherB, admin, studentA1, studentA2, studentB1, studentWithdrawn];

  const cleanup = async (): Promise<void> => {
    // `TrackAssignment.assignedBy` and `LessonOverride.createdBy` reference the
    // teacher with RESTRICT, not CASCADE: a teacher who has made pedagogical
    // decisions cannot be deleted out from under them. Clear those rows first.
    //
    // Without this the cleanup only succeeded when Postgres happened to delete
    // the students before the teacher — a real flake waiting to happen.
    await db.trackAssignment.deleteMany({
      where: { OR: [{ studentId: { in: userIds } }, { assignedBy: { in: userIds } }] },
    });
    await db.lessonOverride.deleteMany({
      where: { OR: [{ studentId: { in: userIds } }, { createdBy: { in: userIds } }] },
    });

    // Same shape of constraint, same reason: `Feedback.authorId` and
    // `Announcement.authorId` are RESTRICT so a teacher's written record does
    // not vanish with them. Tests that exercise the account-retirement flow
    // create both, so clear them before the users go.
    await db.feedback.deleteMany({ where: { authorId: { in: userIds } } });
    await db.announcement.deleteMany({ where: { authorId: { in: userIds } } });

    // AuditLog uses SetNull on actor delete, so its rows would survive as
    // orphans. Remove them explicitly while the ids are still known.
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await db.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
    // Failed logins against a NON-EXISTENT username have no actorId at all —
    // exactly the rows an enumeration scan produces. Match them by prefix.
    await db.auditLog.deleteMany({
      where: { meta: { path: ['username'], string_starts_with: prefix } },
    });
    await db.class.deleteMany({ where: { id: { in: [classA, classB] } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  };

  return {
    db,
    prefix,
    passwordHash,
    teacherA,
    teacherB,
    admin,
    studentA1,
    studentA2,
    studentB1,
    studentWithdrawn,
    classA,
    classB,
    courseId: course.id,
    lessonId: lesson.id,
    problemId: problem.id,
    submissionA1,
    submissionB1,
    cleanup,
  };
}

/** Build an `Actor` from a fixture user id. */
export async function actorFor(db: PrismaClient, userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });
}
