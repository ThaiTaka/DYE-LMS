'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { chamBaiTap } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';
import { SAC_THAI } from '@/components/ui/sac-thai';
import { hienThiLuc } from '@/lib/thoi-gian';

import { PhanHoi } from './dieu-khien-nhanh';
import { XemMaBaiNop } from './xem-ma-bai-nop';

import type { DuLieuMotBaiTapGiaoVien } from '@/lib/teacher-data';

type Hang = DuLieuMotBaiTapGiaoVien['hocSinh'][number];

function NutLuu({ capNhat }: { capNhat: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang lưu…' : capNhat ? 'Cập nhật nhận xét' : 'Lưu nhận xét & đánh dấu đã chấm'}
    </button>
  );
}

/**
 * One child's row on a homework: their code, and the teacher's answer to it.
 *
 * ── Ungraded work is shown open ──────────────────────────────────────────────
 * The code is what is being judged, so for a hand-in waiting on the teacher it
 * is printed in full above the feedback box rather than behind a "Xem mã"
 * toggle — the same rule `ChamTuLuan` applies to essays. Once graded, it
 * folds away behind `XemMaBaiNop` and the feedback takes its place.
 *
 * Plain text in a `<pre>`, never highlighted: the one place a teacher reads
 * untrusted code is the last place to add a parser.
 *
 * ── `banDaXem` ───────────────────────────────────────────────────────────────
 * The form carries the `submittedAt` of the version on screen. If the child
 * hands in again while this page is open, the save is refused and the teacher
 * is told to reload — feedback never lands on code nobody has read.
 */
export function HangChamBaiTap({ hang }: { hang: Hang }) {
  const [ketQua, action] = useActionState(chamBaiTap, CHUA_LAM);
  const [suaNhanXet, setSuaNhanXet] = useState(false);
  const [nhanXet, setNhanXet] = useState(hang.baiNop?.nhanXet ?? '');
  const id = useId();

  // A saved edit closes the form; the re-rendered row shows the new feedback.
  useEffect(() => {
    if (ketQua.trangThai === 'thanh-cong') setSuaNhanXet(false);
  }, [ketQua]);

  const bn = hang.baiNop;

  if (!bn) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 rounded-the-nho border border-white/10 bg-the px-4 py-3">
        <span className="font-semibold">{hang.tenHocSinh}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.trung}`}>
          Chưa nộp
        </span>
      </li>
    );
  }

  const moForm = !bn.daCham || suaNhanXet;

  return (
    <li className="rounded-the-nho border border-white/10 bg-the p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="m-0 text-base font-semibold">{hang.tenHocSinh}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${bn.daCham ? SAC_THAI.dung : SAC_THAI.chinh}`}
        >
          {bn.daCham ? '✓ Đã chấm' : '⏳ Chờ chấm'}
        </span>
        {bn.nopMuon ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.thuLai}`}>
            Nộp sau hạn
          </span>
        ) : null}
        <span className="text-xs font-medium text-chu-nhat">Nộp lúc {hienThiLuc(bn.nopLuc)}</span>
      </div>

      {bn.daCham ? (
        <div className="mb-3">
          <XemMaBaiNop code={bn.code} tenHocSinh={hang.tenHocSinh} />
        </div>
      ) : (
        <pre
          aria-label={`Bài của ${hang.tenHocSinh}`}
          className="mt-0 mb-4 max-h-96 overflow-auto rounded-nut border border-white/10 bg-nen-sau p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap"
        >
          {bn.code}
        </pre>
      )}

      {bn.daCham && !suaNhanXet ? (
        <div className="rounded-nut border border-dung/25 bg-dung/[0.06] p-3">
          <p className="mt-0 mb-1 text-xs font-semibold text-dung">
            Nhận xét của thầy cô{bn.chamLuc ? ` · ${hienThiLuc(bn.chamLuc)}` : ''}
          </p>
          <p className="m-0 text-sm whitespace-pre-wrap">{bn.nhanXet}</p>
          <button
            type="button"
            onClick={() => setSuaNhanXet(true)}
            className="mt-3 min-h-cham rounded-nut border border-white/10 px-3 py-1.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh-sang"
          >
            Sửa nhận xét
          </button>
        </div>
      ) : null}

      {moForm ? (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="submissionId" value={bn.id} />
          <input type="hidden" name="banDaXem" value={bn.nopLuc} />
          <p className="m-0">
            <label htmlFor={`${id}-nx`} className="mb-1 block text-sm font-semibold">
              Nhận xét cho {hang.tenHocSinh}
            </label>
            <textarea
              id={`${id}-nx`}
              name="nhanXet"
              required
              rows={3}
              maxLength={4000}
              value={nhanXet}
              onChange={(e) => setNhanXet(e.target.value)}
              placeholder="Em làm đúng rồi! Thử viết gọn vòng lặp bằng range(1, n + 1) xem sao."
              className="w-full resize-y rounded-nut border border-white/10 bg-be-mat px-3 py-2 text-sm leading-relaxed placeholder:text-chu-nhat focus:border-chinh-sang"
            />
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <NutLuu capNhat={bn.daCham} />
            {suaNhanXet ? (
              <button
                type="button"
                onClick={() => {
                  setSuaNhanXet(false);
                  setNhanXet(bn.nhanXet ?? '');
                }}
                className="min-h-cham rounded-nut px-3 py-1.5 text-sm font-medium text-chu-phu hover:text-chu"
              >
                Thôi
              </button>
            ) : (
              <p className="m-0 text-xs text-chu-nhat">
                Chấm xong thì em không sửa bài này được nữa.
              </p>
            )}
          </div>
        </form>
      ) : null}

      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={ketQua} />
      </div>
    </li>
  );
}
