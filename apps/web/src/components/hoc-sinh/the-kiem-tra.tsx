import Link from 'next/link';

import type { BaiThiHienThi } from '@dye/core';

/**
 * One milestone exam on the course map.
 *
 * Rendered as a distinct card rather than as another lesson row: an exam is a
 * different kind of thing — timed, single-sitting, with a rule attached — and
 * a student scanning the map should be able to see where the checkpoints are
 * without reading each title.
 *
 * The locked state lists WHICH lessons are missing. "Chưa mở" alone sends a
 * child scrolling the map to guess; the list sends them to the right lesson.
 */
export function TheKiemTra({ bai }: { bai: BaiThiHienThi }) {
  const nhan = {
    'chua-mo': { icon: '🔒', chu: 'Chưa mở', mau: 'text-chu-nhat' },
    'san-sang': { icon: '📝', chu: 'Sẵn sàng', mau: 'text-chinh' },
    'dang-lam': { icon: '⏱', chu: 'Đang làm dở', mau: 'text-thu-lai' },
    'da-nop': {
      icon: bai.luot?.isPassed ? '✅' : '📄',
      chu: bai.luot?.isPassed ? 'Đã đạt' : 'Đã nộp',
      mau: bai.luot?.isPassed ? 'text-dung' : 'text-chu-phu',
    },
    'bi-khoa': { icon: '🔒', chu: 'Bị khoá', mau: 'text-thu-lai' },
  }[bai.trangThai];

  const moDuoc = bai.trangThai === 'san-sang' || bai.trangThai === 'dang-lam';
  const xemDuoc = moDuoc || bai.trangThai === 'da-nop' || bai.trangThai === 'bi-khoa';

  const noiDung = (
    <>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl">
          {nhan.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold tracking-wide text-chinh uppercase">
            Bài kiểm tra lớn · sau buổi {bai.afterLessonOrder}
          </p>
          <p className="m-0 text-lg font-bold">{bai.title}</p>
          <p className="m-0 text-sm text-chu-phu">
            {bai.soCauHoi} câu · {bai.durationMinutes} phút · đạt từ {bai.passingScore}%
          </p>
        </div>
        <span className={`shrink-0 text-sm font-semibold ${nhan.mau}`}>{nhan.chu}</span>
      </div>

      {bai.trangThai === 'chua-mo' && bai.conThieu.length > 0 ? (
        <p className="mt-3 mb-0 text-sm text-chu-phu">
          Em hoàn thành{' '}
          {bai.conThieu.length <= 3
            ? bai.conThieu.map((b) => `Buổi ${b.order}`).join(', ')
            : `${bai.conThieu.length} bài học phía trước`}{' '}
          rồi bài này sẽ mở.
        </p>
      ) : null}

      {bai.luot && bai.trangThai === 'da-nop' ? (
        <p className="mt-3 mb-0 text-sm text-chu-phu">
          Điểm: <strong className="text-chu">{bai.luot.score}/{bai.luot.maxScore}</strong>
        </p>
      ) : null}
    </>
  );

  const lop = `block rounded-the border-2 p-5 ${
    bai.trangThai === 'bi-khoa'
      ? 'border-thu-lai bg-thu-lai-nen'
      : moDuoc
        ? 'border-chinh bg-chinh-nhat'
        : 'border-dashed border-vien bg-the'
  }`;

  return xemDuoc ? (
    <Link
      href={`/kiem-tra/${bai.slug}`}
      className={`${lop} hover:border-chinh-dam focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chinh`}
    >
      {noiDung}
    </Link>
  ) : (
    <div className={lop} aria-disabled="true">
      {noiDung}
    </div>
  );
}
