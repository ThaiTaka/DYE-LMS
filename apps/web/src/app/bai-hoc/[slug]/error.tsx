'use client';

import Link from 'next/link';

/**
 * Error boundary for the lesson player.
 *
 * The common case here is a locked lesson requested directly by URL. The gating
 * engine's message says what to finish first, so it is safe and genuinely
 * useful to show — it leaks nothing about other students and it answers the
 * only question a student actually has.
 *
 * Tone stays encouraging. This is a closed door with directions, not a failure.
 */
export default function LoiBaiHoc({ error, reset }: { error: Error; reset: () => void }) {
  // Next.js replaces the message with a generic string in production for
  // unexpected errors; our deliberate gating messages come through intact.
  const thongDiep = error.message?.trim();
  const coHuongDan = Boolean(thongDiep) && thongDiep.length < 300;

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="rounded-the border border-vien bg-the p-6 sm:p-8">
        <p aria-hidden="true" className="m-0 text-4xl">
          🔒
        </p>
        <h1 className="mt-3 mb-2 text-2xl font-bold">Bài học này chưa mở</h1>

        <p className="mt-0 mb-5 text-chu-phu">
          {coHuongDan ? thongDiep : 'Em hãy hoàn thành các bài trước để mở bài này nhé.'}
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/bang-dieu-khien"
            className="inline-flex min-h-cham items-center rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
          >
            Về trang chính
          </Link>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-cham items-center rounded-nut border border-vien px-5 py-2.5 font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
          >
            Thử lại
          </button>
        </div>
      </div>
    </main>
  );
}
