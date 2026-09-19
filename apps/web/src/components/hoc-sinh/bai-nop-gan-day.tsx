import Link from 'next/link';

import { TheKinh } from '@/components/ui/the-kinh';

import type { BaiNopGanDay as HangBaiNop } from '@/lib/student-data';

/**
 * Verdicts in the student's words.
 *
 * Kept in step with `NHAN_KET_QUA` in khu-lam-bai.tsx by hand rather than
 * imported from it: that file is a client component, and pulling a constant
 * out of it would drag the whole editor bundle into a server-rendered page.
 */
const NHAN: Record<string, string> = {
  PENDING: 'Đang chờ chấm',
  RUNNING: 'Đang chấm',
  ACCEPTED: 'Đúng rồi 🎉',
  WRONG_ANSWER: 'Chưa khớp kết quả',
  TIME_LIMIT_EXCEEDED: 'Chạy hơi lâu',
  MEMORY_LIMIT_EXCEEDED: 'Dùng quá nhiều bộ nhớ',
  OUTPUT_LIMIT_EXCEEDED: 'In ra quá nhiều',
  RUNTIME_ERROR: 'Chương trình dừng giữa chừng',
  COMPILE_ERROR: 'Cú pháp chưa đúng',
  INTERNAL_ERROR: 'Lỗi hệ thống',
  SKIPPED: 'Chưa chấm',
};

function gioPhut(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * The student's latest hand-ins, on their dashboard.
 *
 * A server component: the list is read with the rest of the dashboard in one
 * round trip, and nothing here is interactive — each row is a link back to the
 * lesson, where the editor and the full per-exercise history live.
 *
 * Renders nothing rather than an empty box when there is nothing to show. A
 * student on day one has not handed anything in, and "Bài em đã nộp (0)" over a
 * blank panel reads as a reproach.
 */
export function BaiNopGanDay({ baiNop }: { baiNop: HangBaiNop[] }) {
  if (baiNop.length === 0) return null;

  return (
    <TheKinh as="section" aria-labelledby="tieu-de-bai-nop" className="p-5">
      <h2 id="tieu-de-bai-nop" className="mt-0 mb-1 text-base font-bold">
        Bài em đã nộp gần đây
      </h2>
      <p className="mt-0 mb-4 text-sm text-chu-phu">
        Bấm vào một bài để mở lại bài học và xem toàn bộ lịch sử của bài đó.
      </p>

      <ul className="m-0 list-none space-y-2 p-0">
        {baiNop.map((s) => {
          /*
           * Stacked, not side by side: this panel lives in the dashboard's
           * narrow column, where a title and a verdict fighting for one line
           * both end up wrapped. Title, then where/when, then the verdict row.
           */
          const noiDung = (
            <>
              <span className="block font-semibold">{s.problemTitle}</span>
              <span className="block text-sm text-chu-phu">
                {s.lesson ? `Buổi ${s.lesson.order} · ${s.lesson.title} · ` : ''}
                lần {s.attemptNo} · {gioPhut(s.nopLuc)}
              </span>

              <span className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                <span
                  className={
                    s.dangCho
                      ? 'text-chu-phu'
                      : s.verdict === 'ACCEPTED'
                        ? 'font-semibold text-dung'
                        : 'font-medium text-thu-lai'
                  }
                >
                  {s.dangCho ? <span aria-hidden="true">⏳ </span> : null}
                  {NHAN[s.verdict] ?? s.verdict}
                </span>
                {!s.dangCho ? (
                  <span className="text-chu-phu tabular-nums">
                    {s.totalTests > 0 ? `${s.passedTests}/${s.totalTests} test · ` : ''}
                    {s.score}/{s.totalPoints} điểm
                  </span>
                ) : null}
              </span>
            </>
          );

          const lop =
            'block rounded-the-nho border border-vien bg-white/[0.03] p-3.5 transition-colors';

          return (
            <li key={s.id}>
              {s.lesson ? (
                <Link
                  href={`/bai-hoc/${s.lesson.slug}`}
                  className={`${lop} hover:border-chinh-sang/60 hover:bg-white/[0.05]`}
                >
                  {noiDung}
                </Link>
              ) : (
                <div className={lop}>{noiDung}</div>
              )}
            </li>
          );
        })}
      </ul>
    </TheKinh>
  );
}
