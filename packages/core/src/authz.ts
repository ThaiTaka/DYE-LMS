/**
 * Relational authorization.
 *
 * The rule the brief makes non-negotiable: a teacher may reach a student's data
 * ONLY through an actual relationship in the database —
 *
 *     Class.teacherId = me  →  Enrollment(classId, studentId)  →  student
 *
 * never because `role === 'TEACHER'`. A role check alone would let any teacher
 * in the system read any child's submissions, which is precisely the failure
 * mode this module exists to prevent.
 *
 * Three invariants hold for every path through `authorize()`:
 *
 *   1. A disabled account is refused before role is even consulted — admins included.
 *   2. Every branch is explicit. The switch is exhaustiveness-checked, so adding
 *      a resource without a rule is a compile error, not a silent allow.
 *   3. Denial is the default. Nothing reaches the end of a case without either
 *      returning or throwing.
 */
import { AccountDisabledError, ForbiddenError, UnauthorizedError } from './errors';

import type { PrismaClient } from '@prisma/client';
import type { Actor } from './session';

// ═══════════════════════════════════════════════════════════════════════════
// Relational predicates — the only way a teacher reaches a student
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Does this teacher currently teach this student?
 *
 * Requires an ACTIVE enrollment. A student who has left the class is no longer
 * reachable by that teacher: access should end when the relationship ends.
 * If historical access is ever needed it must be an explicit, audited capability
 * rather than an accident of a stale row.
 */
export async function teachesStudent(
  db: PrismaClient,
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const enrollment = await db.enrollment.findFirst({
    where: {
      studentId,
      isActive: true,
      class: { teacherId },
    },
    select: { id: true },
  });
  return enrollment !== null;
}

export async function ownsClass(
  db: PrismaClient,
  teacherId: string,
  classId: string,
): Promise<boolean> {
  const klass = await db.class.findFirst({
    where: { id: classId, teacherId },
    select: { id: true },
  });
  return klass !== null;
}

export async function isEnrolledIn(
  db: PrismaClient,
  studentId: string,
  classId: string,
): Promise<boolean> {
  const enrollment = await db.enrollment.findFirst({
    where: { classId, studentId, isActive: true },
    select: { id: true },
  });
  return enrollment !== null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Request shape
// ═══════════════════════════════════════════════════════════════════════════

export type AuthzRequest =
  /** A student's profile / account. */
  | { resource: 'student'; action: 'read' | 'manage'; studentId: string }
  /** A class and its roster. */
  | { resource: 'class'; action: 'read' | 'manage'; classId: string }
  /** One code submission. */
  | { resource: 'submission'; action: 'read' | 'grade'; submissionId: string }
  /** A student's lesson progress. */
  | { resource: 'progress'; action: 'read'; studentId: string }
  /** Assigning a differentiation tier (Cơ bản / Thử thách / Nâng cao / Mở rộng). */
  | { resource: 'track'; action: 'manage'; studentId: string; courseId: string }
  /** Unlocking, locking, restatusing or waiving prerequisites on a lesson. */
  | {
      resource: 'lessonOverride';
      action: 'manage';
      classId?: string | undefined;
      studentId?: string | undefined;
    }
  /** A Pygame project workspace. */
  | { resource: 'project'; action: 'read' | 'review'; projectId: string }
  /** A quiz attempt. */
  | { resource: 'quizAttempt'; action: 'read'; attemptId: string }
  /** Editing an existing problem and its hidden tests. */
  | { resource: 'problem'; action: 'manage'; problemId: string }
  /** Creating new curriculum content. */
  | { resource: 'curriculum'; action: 'create' };

// ═══════════════════════════════════════════════════════════════════════════
// Guard
// ═══════════════════════════════════════════════════════════════════════════

/** Narrow a possibly-null actor, or refuse. */
export function requireActor(actor: Actor | null | undefined): Actor {
  if (!actor) throw new UnauthorizedError('no-session');
  if (!actor.isActive) throw new AccountDisabledError();
  return actor;
}

/**
 * Throw unless `actor` may perform `request`.
 *
 * Resolves silently on success so call sites read as a precondition:
 *
 *     await authorize(db, actor, { resource: 'submission', action: 'read', submissionId });
 *     const submission = await db.submission.findUnique(...);
 */
export async function authorize(
  db: PrismaClient,
  actor: Actor | null | undefined,
  request: AuthzRequest,
): Promise<void> {
  const me = requireActor(actor);

  switch (request.resource) {
    // ── Student profile ───────────────────────────────────────────────────
    case 'student': {
      if (me.role === 'ADMIN') return;

      if (me.role === 'STUDENT') {
        if (me.id === request.studentId) return;
        throw new ForbiddenError('student-cross-account');
      }

      if (await teachesStudent(db, me.id, request.studentId)) return;
      throw new ForbiddenError('teacher-does-not-teach-student');
    }

    // ── Class ─────────────────────────────────────────────────────────────
    case 'class': {
      if (me.role === 'ADMIN') return;

      if (me.role === 'TEACHER') {
        if (await ownsClass(db, me.id, request.classId)) return;
        throw new ForbiddenError('teacher-does-not-own-class');
      }

      // Students may read a class they are in; they may never manage one.
      if (request.action !== 'read') throw new ForbiddenError('student-cannot-manage-class');
      if (await isEnrolledIn(db, me.id, request.classId)) return;
      throw new ForbiddenError('student-not-enrolled');
    }

    // ── Submission ────────────────────────────────────────────────────────
    case 'submission': {
      if (me.role === 'ADMIN') return;

      const submission = await db.submission.findUnique({
        where: { id: request.submissionId },
        select: { studentId: true },
      });
      // Unknown id is treated as forbidden, not "not found": telling an attacker
      // which ids exist is itself a leak.
      if (!submission) throw new ForbiddenError('submission-not-found');

      if (me.role === 'STUDENT') {
        if (request.action !== 'read') throw new ForbiddenError('student-cannot-grade');
        if (me.id === submission.studentId) return;
        throw new ForbiddenError('student-cross-account');
      }

      if (await teachesStudent(db, me.id, submission.studentId)) return;
      throw new ForbiddenError('teacher-does-not-teach-student');
    }

    // ── Progress ──────────────────────────────────────────────────────────
    case 'progress': {
      if (me.role === 'ADMIN') return;

      if (me.role === 'STUDENT') {
        if (me.id === request.studentId) return;
        throw new ForbiddenError('student-cross-account');
      }

      if (await teachesStudent(db, me.id, request.studentId)) return;
      throw new ForbiddenError('teacher-does-not-teach-student');
    }

    // ── Track assignment (differentiation tier) ───────────────────────────
    case 'track': {
      if (me.role === 'ADMIN') return;
      if (me.role === 'STUDENT') throw new ForbiddenError('student-cannot-assign-track');

      if (await teachesStudent(db, me.id, request.studentId)) return;
      throw new ForbiddenError('teacher-does-not-teach-student');
    }

    // ── Lesson override (unlock / lock / waive prerequisites) ─────────────
    case 'lessonOverride': {
      if (me.role === 'ADMIN') return;
      if (me.role === 'STUDENT') throw new ForbiddenError('student-cannot-override');

      // A global override — no class and no student — changes the curriculum
      // for everyone. That is an admin action.
      if (!request.classId && !request.studentId) {
        throw new ForbiddenError('teacher-cannot-override-globally');
      }
      // Both scopes present: the teacher must hold BOTH relationships.
      if (request.classId && !(await ownsClass(db, me.id, request.classId))) {
        throw new ForbiddenError('teacher-does-not-own-class');
      }
      if (request.studentId && !(await teachesStudent(db, me.id, request.studentId))) {
        throw new ForbiddenError('teacher-does-not-teach-student');
      }
      return;
    }

    // ── Pygame project workspace ──────────────────────────────────────────
    case 'project': {
      if (me.role === 'ADMIN') return;

      const project = await db.gameProject.findUnique({
        where: { id: request.projectId },
        select: { studentId: true },
      });
      if (!project) throw new ForbiddenError('project-not-found');

      if (me.role === 'STUDENT') {
        if (request.action !== 'read') throw new ForbiddenError('student-cannot-review');
        if (me.id === project.studentId) return;
        throw new ForbiddenError('student-cross-account');
      }

      if (await teachesStudent(db, me.id, project.studentId)) return;
      throw new ForbiddenError('teacher-does-not-teach-student');
    }

    // ── Quiz attempt ──────────────────────────────────────────────────────
    case 'quizAttempt': {
      if (me.role === 'ADMIN') return;

      const attempt = await db.quizAttempt.findUnique({
        where: { id: request.attemptId },
        select: { studentId: true },
      });
      if (!attempt) throw new ForbiddenError('attempt-not-found');

      if (me.role === 'STUDENT') {
        if (me.id === attempt.studentId) return;
        throw new ForbiddenError('student-cross-account');
      }

      if (await teachesStudent(db, me.id, attempt.studentId)) return;
      throw new ForbiddenError('teacher-does-not-teach-student');
    }

    // ── Editing an existing problem (includes HIDDEN tests) ───────────────
    case 'problem': {
      if (me.role === 'ADMIN') return;
      if (me.role === 'STUDENT') throw new ForbiddenError('student-cannot-edit-problem');

      const problem = await db.problem.findUnique({
        where: { id: request.problemId },
        select: { authorId: true },
      });
      if (!problem) throw new ForbiddenError('problem-not-found');

      // A teacher edits what they authored. Seeded curriculum has no author,
      // so it is admin-only until an admin assigns ownership.
      if (problem.authorId && problem.authorId === me.id) return;
      throw new ForbiddenError('teacher-does-not-own-problem');
    }

    // ── Creating new curriculum content ───────────────────────────────────
    case 'curriculum': {
      if (me.role === 'ADMIN' || me.role === 'TEACHER') return;
      throw new ForbiddenError('student-cannot-create-curriculum');
    }

    default: {
      // Exhaustiveness check. Adding a resource without a rule fails to compile
      // here rather than silently falling through to "allowed".
      const unreachable: never = request;
      throw new ForbiddenError(`unhandled-resource:${JSON.stringify(unreachable)}`);
    }
  }
}

/**
 * Non-throwing variant, for deciding whether to render a button.
 *
 * Never use this to protect data — a hidden button is not access control.
 * Every route and server action must still call `authorize()`.
 */
export async function can(
  db: PrismaClient,
  actor: Actor | null | undefined,
  request: AuthzRequest,
): Promise<boolean> {
  try {
    await authorize(db, actor, request);
    return true;
  } catch {
    return false;
  }
}

/**
 * Every student this teacher may legitimately reach.
 *
 * Derived from the same relationship `authorize()` uses, so a list endpoint and
 * a detail endpoint can never disagree about who is visible.
 */
export async function visibleStudentIds(db: PrismaClient, actor: Actor): Promise<string[]> {
  if (!actor.isActive) throw new AccountDisabledError();

  if (actor.role === 'STUDENT') return [actor.id];

  if (actor.role === 'ADMIN') {
    const all = await db.user.findMany({ where: { role: 'STUDENT' }, select: { id: true } });
    return all.map((u) => u.id);
  }

  const enrollments = await db.enrollment.findMany({
    where: { isActive: true, class: { teacherId: actor.id } },
    select: { studentId: true },
    distinct: ['studentId'],
  });
  return enrollments.map((e) => e.studentId);
}
