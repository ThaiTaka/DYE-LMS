'use client';

import { useId, useState } from 'react';

/**
 * Code playground — Phase 5 shell.
 *
 * A real, editable textarea so the block is usable today, but running code
 * needs the sandboxed judge (Phase 8) and syntax highlighting needs CodeMirror
 * (Phase 7). The "Chạy thử" button is therefore visibly disabled with a plain
 * explanation rather than silently doing nothing — a dead button teaches a
 * student to distrust the interface.
 */
export function SanChoiCode({
  maNguon,
  mucTieu,
  nhan = 'Khung soạn thảo',
}: {
  maNguon: string;
  mucTieu?: string | undefined;
  nhan?: string;
}) {
  const [code, setCode] = useState(maNguon);
  const id = useId();

  return (
    <div className="rounded-nut border border-vien bg-the">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-vien px-4 py-2.5">
        <label htmlFor={id} className="m-0 text-sm font-semibold">
          {nhan}
        </label>
        <button
          type="button"
          disabled
          title="Tính năng chạy code sẽ có ở bản cập nhật sau"
          className="min-h-cham cursor-not-allowed rounded-nut border border-vien px-3 py-1.5 text-sm font-medium text-chu-nhat"
        >
          ▶ Chạy thử
        </button>
      </div>

      <textarea
        id={id}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={Math.min(18, Math.max(6, code.split('\n').length + 2))}
        aria-describedby={mucTieu ? `${id}-muc-tieu` : undefined}
        className="block w-full resize-y border-0 bg-transparent p-4 font-mono text-sm leading-relaxed text-chu focus:outline-none"
      />

      <p className="m-0 border-t border-vien px-4 py-2.5 text-sm text-chu-nhat">
        Em cứ gõ thử thoải mái. Nút chạy code sẽ được bật ở bản cập nhật tới.
      </p>

      {mucTieu ? (
        <p id={`${id}-muc-tieu`} className="m-0 border-t border-vien px-4 py-2.5 text-sm">
          <strong>Mục tiêu:</strong> {mucTieu}
        </p>
      ) : null}
    </div>
  );
}
