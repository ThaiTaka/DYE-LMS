import { cauHoiChoBaiThi, moBaiThi } from '@dye/core';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PhongThi } from '@/components/hoc-sinh/phong-thi';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/guard';

/**
 * The exam page.
 *
 * ── What reaches the browser, and when ───────────────────────────────────────
 * The questions are sent ONLY when the exam is open to this student — ready
 * to start, or a sitting in progress. A locked exam, a finished one, or one
 * whose prerequisites are unmet gets the frame and the status, and no
 * question text. There is no reason for a student who cannot sit the exam to
 * hold its questions, and every reason not to hand them out early.
 *
 * Even when sent, the questions carry no answer key: `cauHoiChoBaiThi`
 * selects `isCorrect` and `acceptedAnswers` out by construction.
 *
 * ── No shell ─────────────────────────────────────────────────────────────────
 * The exam room is rendered without `VoHocSinh`. The nav, the streak, the
 * badges are distractions at best and, in fullscreen, a way out of the room.
 * The room renders its own way back to the course map.
 */
export default async function TrangKiemTra({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requireSession();
  if (actor.role !== 'STUDENT') redirect('/giao-vien');

  const { slug } = await params;
  const bai = await moBaiThi(db, actor.id, slug);
  if (!bai) notFound();

  if (bai.trangThai === 'chua-mo') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="m-0 text-sm font-semibold tracking-wide text-chinh uppercase">
          Bài kiểm tra lớn · {bai.courseTitle}
        </p>
        <h1 className="mt-1 mb-3 text-3xl font-bold">{bai.title}</h1>
        <section className="rounded-the border border-vien bg-the p-6">
          <p aria-hidden="true" className="m-0 text-4xl">
            🔒
          </p>
          <h2 className="mt-3 mb-2 text-xl font-bold">Bài này chưa mở</h2>
          <p className="mt-0 mb-4 text-chu-phu">
            Em hoàn thành các bài học phía trước rồi quay lại nhé:
          </p>
          <ul className="m-0 mb-6 list-disc space-y-1 ps-5">
            {bai.conThieu.map((b) => (
              <li key={b.slug}>
                <Link href={`/bai-hoc/${b.slug}`} className="font-semibold text-chinh hover:underline">
                  Buổi {b.order} · {b.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/khoa-hoc/${bai.courseSlug}`}
            className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
          >
            ← Về bản đồ khoá học
          </Link>
        </section>
      </main>
    );
  }

  const mo = bai.trangThai === 'san-sang' || bai.trangThai === 'dang-lam';
  const cauHoi = mo ? await cauHoiChoBaiThi(db, bai.examId) : [];

  // The in-progress sitting's saved answers, so a reload resumes where it was.
  const dangLam =
    bai.trangThai === 'dang-lam' && bai.luot
      ? await db.examAttempt.findUnique({
          where: { id: bai.luot.attemptId },
          select: { id: true, deadlineAt: true, answers: true },
        })
      : null;

  const daXong =
    bai.luot && (bai.luot.state === 'SUBMITTED' || bai.luot.state === 'LOCKED_CHEATING')
      ? {
          state: bai.luot.state,
          score: bai.luot.score,
          maxScore: bai.luot.maxScore,
          isPassed: bai.luot.isPassed,
          cheatStrikes: bai.luot.cheatStrikes,
        }
      : null;

  return (
    <PhongThi
      examId={bai.examId}
      title={bai.title}
      description={bai.description}
      durationMinutes={bai.durationMinutes}
      passingScore={bai.passingScore}
      maxStrikes={bai.maxStrikes}
      soCauHoi={bai.soCauHoi}
      courseSlug={bai.courseSlug}
      courseTitle={bai.courseTitle}
      cauHoi={cauHoi}
      luotDangLam={
        dangLam
          ? {
              attemptId: dangLam.id,
              deadlineAt: dangLam.deadlineAt.toISOString(),
              answers: (dangLam.answers ?? {}) as Record<string, unknown>,
            }
          : null
      }
      luotDaXong={daXong}
    />
  );
}
