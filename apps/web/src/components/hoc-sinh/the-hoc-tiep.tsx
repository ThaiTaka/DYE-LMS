import Link from 'next/link';

import { BieuTuong } from '@/components/ui/bieu-tuong';
import { TheKinh } from '@/components/ui/the-kinh';

import type { DuLieuBangDieuKhien } from '@/lib/student-data';

/** The default backdrop: a self-hosted SVG, so it cannot go missing behind a school firewall. */
const ANH_MAC_DINH = '/hinh/hero-vu-tru.svg';

/**
 * The "Học tiếp" hero.
 *
 * This is the single most important control on the dashboard, and it answers
 * "What's next?" without asking the student to decide anything. Its target
 * comes from the Phase 4 engine — the first unlocked, unfinished lesson on
 * *this* student's required track — so it can never point at a locked lesson
 * or at work assigned to someone else.
 *
 * ── The picture, and why the text still reads ────────────────────────────────
 * A full-bleed image with a left-to-right dark overlay on top of it
 * (`phu-hero` in globals.css: 95% navy at the left edge fading to 15% at the
 * right). The copy lives in the left 60%, over the opaque part, so white text
 * is white-on-navy regardless of what the picture does — and it can be swapped
 * for a course-specific photo through `anhNen` without anyone re-checking
 * contrast. The bottom fade lets the card sink into the page instead of
 * ending on a hard edge.
 *
 * One primary action per screen: the gradient button is the only one on the
 * dashboard. "Xem bản đồ" is an outlined pill so it cannot be mistaken for it.
 */
export function TheHocTiep({
  tiepTuc,
  anhNen = ANH_MAC_DINH,
}: {
  tiepTuc: DuLieuBangDieuKhien['tiepTuc'];
  /** Background picture. Any URL the app may load; the overlay handles legibility. */
  anhNen?: string;
}) {
  if (!tiepTuc) {
    return (
      <TheKinh as="section" className="p-6 sm:p-8">
        <p aria-hidden="true" className="m-0 text-4xl">
          🛰️
        </p>
        <h2 className="mt-3 mb-2 text-2xl font-bold">Chưa có bài học nào</h2>
        <p className="m-0 text-chu-phu">
          Em chưa được ghi danh vào lớp nào. Hãy hỏi thầy cô để được thêm vào lớp nhé.
        </p>
      </TheKinh>
    );
  }

  return (
    <section
      aria-labelledby="tieu-de-hoc-tiep"
      className="relative isolate min-h-[19rem] overflow-hidden rounded-the border border-white/10 shadow-noi"
    >
      {/* Layer 1 — the picture. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: `url(${anhNen})` }}
      />
      {/* Layer 2 — the cinematic overlay that keeps the copy legible. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 phu-hero" />
      {/* Layer 3 — a short fade at the foot so the card sits into the page. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-linear-to-t from-nen/80 to-transparent"
      />

      <div className="relative flex min-h-[19rem] flex-col justify-end gap-4 p-6 sm:p-8 lg:max-w-[62%] lg:p-10">
        <p className="m-0 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-chinh-sang uppercase">
          <BieuTuong ten="lapLanh" className="size-5" />
          Tiếp theo · {tiepTuc.courseTitle}
        </p>

        <h2
          id="tieu-de-hoc-tiep"
          className="m-0 text-3xl leading-tight font-extrabold text-balance sm:text-4xl"
        >
          <span className="chu-neon">Buổi {tiepTuc.lessonOrder}</span>
          <span className="text-chu"> · {tiepTuc.lessonTitle}</span>
        </h2>

        <p className="m-0 max-w-prose text-chu-phu">
          Tiếp tục đúng chỗ em đã dừng. Bài này đã mở sẵn cho em rồi.
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link href={`/bai-hoc/${tiepTuc.lessonSlug}`} className="nut-neon px-6 text-base">
            Học tiếp
            <BieuTuong ten="muiTen" className="size-5" />
          </Link>
          <Link href={`/khoa-hoc/${tiepTuc.courseSlug}`} className="nut-vien text-sm">
            <BieuTuong ten="banDo" className="size-5" />
            Xem bản đồ
          </Link>
        </div>
      </div>
    </section>
  );
}
