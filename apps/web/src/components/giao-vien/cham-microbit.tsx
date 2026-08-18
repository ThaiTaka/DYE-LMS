'use client';

import { useId, useState, useTransition } from 'react';

import { chamBaiMicrobit } from '@/app/giao-vien/actions';
import type { KetQuaHanhDong } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

/**
 * Local "not run yet" value, deliberately NOT the `CHUA_LAM` constant exported
 * from the actions module.
 *
 * Everything exported from a `'use server'` file becomes a callable server
 * reference, including plain objects. `useState` treats any callable argument as
 * a lazy initialiser and invokes it — which raises "Server Functions cannot be
 * called during initial render" and takes the whole page down with a 500.
 *
 * Passing it to `useActionState` is fine, because that never calls its initial
 * state. That is why the other teacher controls import it safely and this one
 * cannot.
 */
const CHUA_CHAM: KetQuaHanhDong = { trangThai: 'chua-lam', thongDiep: '' };

export interface ChamMicrobitProps {
  submissionId: string;
  tenHocSinh: string;
  totalPoints: number;
  diemHienTai: number;
  daCham: boolean;
}

/**
 * Manual grading for a Micro:bit submission.
 *
 * Two conclusions only — "đạt" and "chưa đạt" — because those are the two a
 * teacher can actually reach by reading blocks. The wording avoids "sai": a
 * student whose blocks are nearly right has not failed, they have not finished,
 * and those are different things to be told.
 */
export function ChamMicrobit({
  submissionId,
  tenHocSinh,
  totalPoints,
  diemHienTai,
  daCham,
}: ChamMicrobitProps) {
  const [nhanXet, setNhanXet] = useState('');
  const [diem, setDiem] = useState(daCham ? diemHienTai : totalPoints);
  const [kq, setKq] = useState<KetQuaHanhDong>(CHUA_CHAM);
  const [dangGui, batDau] = useTransition();
  const id = useId();

  const gui = (verdict: 'ACCEPTED' | 'WRONG_ANSWER'): void => {
    const fd = new FormData();
    fd.set('submissionId', submissionId);
    fd.set('verdict', verdict);
    fd.set('score', String(verdict === 'ACCEPTED' ? diem : Math.min(diem, totalPoints - 1)));
    fd.set('nhanXet', nhanXet);

    batDau(async () => {
      setKq(await chamBaiMicrobit(CHUA_CHAM, fd));
    });
  };

  const duNhanXet = nhanXet.trim().length >= 3;

  return (
    <section
      aria-labelledby={`${id}-cham`}
      className="rounded-the border border-vien bg-the p-5 sm:p-6"
    >
      <h2 id={`${id}-cham`} className="mt-0 mb-1 text-lg font-bold">
        Chấm bài cho {tenHocSinh}
      </h2>
      <p className="mt-0 mb-4 text-sm text-chu-phu">
        Bài Micro:bit không chấm tự động được — chương trình chạy trên board thật, không có đầu ra
        nào để máy so sánh. Thầy cô đọc các khối lệnh rồi kết luận.
        {daCham ? ' Bài này đã được chấm; gửi lại sẽ ghi đè kết luận cũ.' : ''}
      </p>

      <label htmlFor={`${id}-nx`} className="mb-1.5 block text-sm font-semibold">
        Nhận xét cho em <span className="font-normal text-chu-nhat">(em sẽ đọc nguyên văn)</span>
      </label>
      <textarea
        id={`${id}-nx`}
        value={nhanXet}
        onChange={(e) => setNhanXet(e.target.value)}
        rows={4}
        placeholder="Nêu cụ thể em làm đúng chỗ nào, và chỗ nào cần chỉnh."
        className="mb-4 w-full rounded-nut border border-vien bg-the p-3 text-base"
      />

      <div className="mb-4">
        <label htmlFor={`${id}-diem`} className="mb-1.5 block text-sm font-semibold">
          Điểm <span className="font-normal text-chu-nhat">(trên {totalPoints})</span>
        </label>
        <input
          id={`${id}-diem`}
          type="number"
          min={0}
          max={totalPoints}
          value={diem}
          onChange={(e) => setDiem(Number(e.target.value))}
          className="min-h-cham w-32 rounded-nut border border-vien bg-the px-3 py-2 text-base tabular-nums"
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          disabled={dangGui || !duNhanXet}
          onClick={() => gui('ACCEPTED')}
          className="min-h-cham rounded-nut border-2 border-dung bg-dung-nen p-3.5 text-start disabled:opacity-50"
        >
          <span className="block font-semibold text-dung">✓ Đạt yêu cầu</span>
          <span className="mt-0.5 block text-sm text-chu-phu">
            Bài này tính là hoàn thành, tiến độ của em được cập nhật.
          </span>
        </button>

        <button
          type="button"
          disabled={dangGui || !duNhanXet}
          onClick={() => gui('WRONG_ANSWER')}
          className="min-h-cham rounded-nut border-2 border-thu-lai bg-thu-lai-nen p-3.5 text-start disabled:opacity-50"
        >
          <span className="block font-semibold text-thu-lai">↻ Chưa đạt, em làm lại nhé</span>
          <span className="mt-0.5 block text-sm text-chu-phu">
            Em đọc nhận xét rồi chỉnh và nộp lại.
          </span>
        </button>
      </div>

      {!duNhanXet ? (
        <p className="m-0 mt-3 text-sm text-chu-nhat">
          Thầy cô viết vài dòng nhận xét trước khi kết luận nhé — em cần biết vì sao.
        </p>
      ) : null}

      <PhanHoi ketQua={kq} />
    </section>
  );
}

/**
 * The submitted block workspace.
 *
 * Shown as text rather than re-rendered as blocks: re-rendering would mean
 * loading the MakeCode editor a second time and risk showing something subtly
 * different from what the student handed in. What a teacher needs is certainty
 * about the bytes on record.
 */
export function XemKhoiLenh({
  blocksXml,
  loiGiaiMau,
}: {
  blocksXml: string;
  loiGiaiMau: string;
}) {
  const [xemMau, setXemMau] = useState(false);
  const id = useId();

  return (
    <section aria-labelledby={`${id}-khoi`} className="rounded-the border border-vien bg-the">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vien px-4 py-2.5">
        <h2 id={`${id}-khoi`} className="m-0 text-base font-bold">
          Khối lệnh em đã nộp
        </h2>
        {loiGiaiMau ? (
          <button
            type="button"
            onClick={() => setXemMau((v) => !v)}
            aria-expanded={xemMau}
            className="min-h-cham rounded-nut border border-vien px-3.5 py-1.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
          >
            {xemMau ? 'Ẩn lời giải mẫu' : 'Xem lời giải mẫu'}
          </button>
        ) : null}
      </div>

      <pre className="m-0 max-h-96 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap">
        <code>{blocksXml || '(học sinh nộp bài với vùng làm việc trống)'}</code>
      </pre>

      {xemMau ? (
        <div className="border-t border-vien">
          <p className="m-0 bg-the-mo px-4 py-2 text-sm font-semibold">
            Lời giải mẫu — chỉ thầy cô nhìn thấy
          </p>
          <pre className="m-0 max-h-72 overflow-auto p-4 font-mono text-sm whitespace-pre-wrap">
            <code>{loiGiaiMau}</code>
          </pre>
        </div>
      ) : null}
    </section>
  );
}
