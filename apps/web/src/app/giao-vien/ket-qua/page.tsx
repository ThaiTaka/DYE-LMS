import Link from 'next/link';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { XemMaBaiNop } from '@/components/giao-vien/xem-ma-bai-nop';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { duLieuKetQuaBaiNop } from '@/lib/teacher-data';

/** Student-facing wording for each verdict. Mirrors the editor's own table. */
const NHAN_KET_QUA: Record<string, string> = {
  PENDING: 'Đang chờ chấm',
  RUNNING: 'Đang chấm',
  ACCEPTED: 'Đúng',
  WRONG_ANSWER: 'Chưa khớp kết quả',
  TIME_LIMIT_EXCEEDED: 'Chạy quá lâu',
  MEMORY_LIMIT_EXCEEDED: 'Quá bộ nhớ',
  OUTPUT_LIMIT_EXCEEDED: 'In ra quá nhiều',
  RUNTIME_ERROR: 'Dừng giữa chừng',
  COMPILE_ERROR: 'Cú pháp chưa đúng',
  INTERNAL_ERROR: 'Lỗi hệ thống',
  SKIPPED: 'Chưa chấm',
};

/** Order the filter chips are offered in — most useful to a teacher first. */
const THU_TU_LOC = [
  'WRONG_ANSWER',
  'ACCEPTED',
  'RUNTIME_ERROR',
  'TIME_LIMIT_EXCEEDED',
  'COMPILE_ERROR',
  'PENDING',
];

function mauKetQua(verdict: string): string {
  if (verdict === 'ACCEPTED') return 'bg-dung-nen text-dung';
  if (verdict === 'PENDING' || verdict === 'RUNNING' || verdict === 'SKIPPED') {
    return 'bg-the-mo text-chu-phu';
  }
  if (verdict === 'INTERNAL_ERROR') return 'bg-thu-lai-nen text-thu-lai';
  return 'bg-loi-nen text-loi';
}

function gioPhut(d: Date): string {
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Submission results across the classes this actor runs.
 *
 * ── What this page is for ────────────────────────────────────────────────────
 * "What happened in the last lesson?" A teacher walks in, opens this, and reads
 * down. So it is sorted by TIME, newest first — not by student and not by score.
 * A table sorted by score is a ranking of children with extra steps, and this
 * codebase does not build those.
 *
 * The default view is everything; the filter chips exist because the useful
 * question is usually narrower — "who is stuck?" is `WRONG_ANSWER`, and it is
 * offered first for that reason.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * Enforced once, in `duLieuKetQuaBaiNop`, from `visibleStudentIds`. This page
 * re-expresses no part of it.
 */
export default async function TrangKetQua({
  searchParams,
}: {
  searchParams: Promise<{ ket_qua?: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { ket_qua } = await searchParams;
  const loc = ket_qua && NHAN_KET_QUA[ket_qua] ? ket_qua : undefined;

  const data = await duLieuKetQuaBaiNop(actor, loc ? { verdict: loc } : undefined);
  const tong = Object.values(data.demTheoKetQua).reduce((a, b) => a + b, 0);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Kết quả bài nộp' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Kết quả bài nộp</h1>
        <p className="m-0 text-chu-phu">
          {data.toanHeThong
            ? 'Toàn hệ thống — mọi lớp trong trường.'
            : 'Các lớp thầy cô đang phụ trách.'}{' '}
          Bài mới nhất lên trước. Bài Micro:bit có hàng chấm riêng ở{' '}
          <Link href="/giao-vien/microbit" className="font-semibold text-chinh hover:underline">
            trang Micro:bit
          </Link>
          .
        </p>
      </header>

      {/* ── Filter chips ───────────────────────────────────────────────── */}
      <nav aria-label="Lọc theo kết quả" className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/giao-vien/ket-qua"
          aria-current={loc ? undefined : 'page'}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            loc ? 'border-vien text-chu-phu hover:border-chinh' : 'border-chinh bg-chinh text-white'
          }`}
        >
          Tất cả ({tong})
        </Link>

        {THU_TU_LOC.filter((v) => (data.demTheoKetQua[v] ?? 0) > 0).map((v) => (
          <Link
            key={v}
            href={`/giao-vien/ket-qua?ket_qua=${v}`}
            aria-current={loc === v ? 'page' : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              loc === v ? 'border-chinh bg-chinh text-white' : 'border-vien text-chu-phu hover:border-chinh'
            }`}
          >
            {NHAN_KET_QUA[v]} ({data.demTheoKetQua[v]})
          </Link>
        ))}
      </nav>

      {data.bai.length === 0 ? (
        <p className="rounded-the border border-vien bg-the p-5 text-chu-phu">
          {tong === 0
            ? 'Chưa có bài nộp nào trong các lớp của thầy cô.'
            : 'Không có bài nào khớp bộ lọc này.'}
        </p>
      ) : (
        <>
          {/*
            One card per submission rather than a <table>. The row carries five
            fields plus an expandable code panel, and a real table would either
            scroll sideways on a phone or hide the column that matters.
          */}
          <ul className="m-0 list-none space-y-3 p-0">
            {data.bai.map((b) => (
              <li key={b.submissionId} className="rounded-the border border-vien bg-the p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h2 className="mt-0 mb-1 text-base font-semibold">
                      <Link
                        href={`/giao-vien/hoc-sinh/${b.studentId}`}
                        className="hover:underline"
                      >
                        {b.tenHocSinh}
                      </Link>
                    </h2>
                    <p className="m-0 text-sm text-chu-phu">
                      {b.lessonOrder > 0 ? `Buổi ${b.lessonOrder} · ` : ''}
                      {b.lessonTitle ? `${b.lessonTitle} · ` : ''}
                      {b.problemTitle}
                    </p>
                    <p className="m-0 mt-1 text-xs text-chu-nhat">
                      Lần {b.attemptNo} · {gioPhut(b.nopLuc)}
                      {b.score !== null ? ` · ${b.score}/${b.totalPoints} điểm` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${mauKetQua(b.verdict)}`}
                    >
                      {NHAN_KET_QUA[b.verdict] ?? b.verdict}
                    </span>
                    <XemMaBaiNop code={b.code} tenHocSinh={b.tenHocSinh} />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {data.conNua ? (
            <p className="mt-4 text-sm text-chu-nhat">
              Đang hiện {data.bai.length} bài mới nhất. Dùng bộ lọc ở trên để thu hẹp lại.
            </p>
          ) : null}
        </>
      )}
    </VoGiaoVien>
  );
}
