'use client';

import { useId, useState } from 'react';

/**
 * Disclosure for one submission's source.
 *
 * A `<details>` element would be shorter, but the code is often long and the
 * table needs the closed state to stay one row tall — so this controls its own
 * open state and renders nothing at all while closed, rather than relying on the
 * browser's default box.
 *
 * The code is rendered as plain text in a `<pre>`, never highlighted. Any
 * highlighter would have to parse a string a student wrote, and the one place a
 * teacher reads untrusted code is the last place to add a parser.
 */
export function XemMaBaiNop({ code, tenHocSinh }: { code: string; tenHocSinh: string }) {
  const [mo, setMo] = useState(false);
  const id = useId();
  const vungId = `${id}-ma`;

  return (
    <>
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        aria-expanded={mo}
        aria-controls={vungId}
        className="min-h-cham rounded-nut border border-vien px-3 py-1.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
      >
        {mo ? 'Đóng mã' : '</> Xem mã'}
      </button>

      {mo ? (
        <div id={vungId} className="mt-3">
          <p className="mt-0 mb-2 text-xs text-chu-nhat">Bài của {tenHocSinh}</p>
          <pre className="m-0 max-h-96 overflow-auto rounded-nut bg-the-mo p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {code}
          </pre>
        </div>
      ) : null}
    </>
  );
}
