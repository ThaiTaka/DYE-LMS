'use client';

import { useState, useTransition } from 'react';

import { danhDauKhoiXong } from '@/app/bai-hoc/[slug]/actions';

/**
 * "Em đã đọc xong" — the button that completes a reading block.
 *
 * ── Why a button and not a scroll sensor ─────────────────────────────────────
 * Every block type that is not code or quiz — theory, example, video, resource,
 * reflection — had NO way to be completed. `danhDauKhoiXong` existed and
 * nothing called it, so a lesson with one paragraph of theory in it could
 * never finish and the next never unlocked. That is the "rigid and confusing"
 * a Grade-5 class reported.
 *
 * The fix is an explicit, large, single-purpose button rather than "mark read
 * when scrolled to the bottom". A ten-year-old understands a button they
 * pressed; they do not understand a checkmark that appeared because they
 * scrolled past something, and they cannot un-press it to re-read. Pressing it
 * is the effort. That is the whole rule.
 *
 * ── Idempotent, optimistic, honest ───────────────────────────────────────────
 * Already-complete blocks render the done state and no button. The click
 * flips to "Đã xong" immediately and reverts with a message only if the server
 * refused — which it does for a lesson the student cannot open.
 */
export function NutDaDocXong({
  blockId,
  daXong,
  nhan = 'Em đã đọc xong',
}: {
  blockId: string;
  daXong: boolean;
  nhan?: string;
}) {
  const [xong, setXong] = useState(daXong);
  const [loi, setLoi] = useState('');
  const [dangGui, batDau] = useTransition();

  if (xong) {
    return (
      <p role="status" className="mt-5 mb-0 inline-flex min-h-cham items-center gap-2 rounded-nut bg-dung-nen px-4 py-2 font-semibold text-dung">
        <span aria-hidden="true">✅</span> Xong phần này rồi!
      </p>
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        disabled={dangGui}
        onClick={() => {
          setLoi('');
          setXong(true);
          batDau(async () => {
            const kq = await danhDauKhoiXong(blockId).catch(() => ({ baiXong: false, daGhi: false }));
            if (!('daGhi' in kq) || kq.daGhi === false) {
              // The server did not record it. Do not pretend.
              if ('daGhi' in kq) {
                setXong(false);
                setLoi('Chưa ghi nhận được. Em thử bấm lại nhé.');
              }
            }
          });
        }}
        className="inline-flex min-h-[3.25rem] items-center gap-3 rounded-nut bg-chinh px-6 py-3 text-lg font-bold text-white shadow-sm hover:bg-chinh-dam focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chinh disabled:opacity-60"
      >
        <span aria-hidden="true" className="text-2xl">
          ✔
        </span>
        {nhan}
      </button>
      {loi ? (
        <p role="alert" className="mt-2 mb-0 text-sm text-thu-lai">
          {loi}
        </p>
      ) : null}
    </div>
  );
}
