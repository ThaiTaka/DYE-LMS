import Link from 'next/link';

import type { DuLieuBangDieuKhien } from '@/lib/student-data';

/**
 * The "Học tiếp" card.
 *
 * This is the single most important control on the dashboard, and it answers
 * "What's next?" without asking the student to decide anything. Its target
 * comes from the Phase 4 engine — the first unlocked, unfinished lesson on
 * *this* student's required track — so it can never point at a locked lesson
 * or at work assigned to someone else.
 *
 * One primary action per screen: everything else on the page is secondary.
 */
export function TheHocTiep({ tiepTuc }: { tiepTuc: DuLieuBangDieuKhien['tiepTuc'] }) {
  if (!tiepTuc) {
    return (
      <section className="rounded-the border border-vien bg-the p-6">
        <h2 className="mt-0 mb-2 text-xl font-bold">Chưa có bài học nào</h2>
        <p className="m-0 text-chu-phu">
          Em chưa được ghi danh vào lớp nào. Hãy hỏi thầy cô để được thêm vào lớp nhé.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="tieu-de-hoc-tiep"
      className="rounded-the border border-chinh/25 bg-chinh-nhat p-6 sm:p-7"
    >
      <p className="m-0 text-sm font-semibold tracking-wide text-chinh uppercase">Tiếp theo</p>

      <h2 id="tieu-de-hoc-tiep" className="mt-1 mb-1 text-2xl font-bold leading-snug">
        Buổi {tiepTuc.lessonOrder} · {tiepTuc.lessonTitle}
      </h2>

      <p className="mt-0 mb-5 text-chu-phu">{tiepTuc.courseTitle}</p>

      <Link
        href={`/bai-hoc/${tiepTuc.lessonSlug}`}
        className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-6 py-3 text-base font-semibold text-white hover:bg-chinh-dam"
      >
        Học tiếp
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
