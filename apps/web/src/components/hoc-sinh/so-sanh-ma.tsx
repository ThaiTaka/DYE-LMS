'use client';

import { useMemo } from 'react';

export type LoaiDong = 'giu' | 'them' | 'bot';

export interface DongSoSanh {
  loai: LoaiDong;
  /** Line number in the old version, null for an added line. */
  soCu: number | null;
  /** Line number in the new version, null for a removed line. */
  soMoi: number | null;
  chu: string;
}

/**
 * Line diff via longest common subsequence.
 *
 * Written out rather than pulled from a library because the need is small and
 * exact: two versions of one student's file, a few dozen lines, no rename
 * detection, no word-level splitting. A dependency here would be more code
 * shipped to a school laptop than the twenty lines it replaces.
 *
 * Guards against pathological input by bailing to a plain replace-everything
 * diff when the file is large — an O(n·m) table on two 2000-line files would
 * freeze the tab, and this runs in the browser.
 */
export function soSanhDong(cu: string, moi: string): DongSoSanh[] {
  const a = cu.split('\n');
  const b = moi.split('\n');

  const NGUONG = 800;
  if (a.length > NGUONG || b.length > NGUONG) {
    return [
      ...a.map((chu, i) => ({ loai: 'bot' as const, soCu: i + 1, soMoi: null, chu })),
      ...b.map((chu, i) => ({ loai: 'them' as const, soCu: null, soMoi: i + 1, chu })),
    ];
  }

  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const ket: DongSoSanh[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ket.push({ loai: 'giu', soCu: i + 1, soMoi: j + 1, chu: a[i]! });
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ket.push({ loai: 'bot', soCu: i + 1, soMoi: null, chu: a[i]! });
      i += 1;
    } else {
      ket.push({ loai: 'them', soCu: null, soMoi: j + 1, chu: b[j]! });
      j += 1;
    }
  }
  while (i < a.length) {
    ket.push({ loai: 'bot', soCu: i + 1, soMoi: null, chu: a[i]! });
    i += 1;
  }
  while (j < b.length) {
    ket.push({ loai: 'them', soCu: null, soMoi: j + 1, chu: b[j]! });
    j += 1;
  }

  return ket;
}

const KIEU_DONG: Record<LoaiDong, { nen: string; dau: string; doc: string }> = {
  // Green for added, amber for removed. Deliberately NOT red: an earlier draft
  // is not a mistake, and this is a child's own work being shown back to them.
  them: { nen: 'bg-dung-nen', dau: '+', doc: 'dòng thêm' },
  bot: { nen: 'bg-thu-lai-nen', dau: '−', doc: 'dòng bỏ' },
  giu: { nen: '', dau: ' ', doc: '' },
};

/**
 * Side-by-side-ish diff, rendered as one column with markers.
 *
 * One column rather than two because this has to be readable on the iPad the
 * brief names as a target: two 40-column panes on a tablet gives two unreadable
 * panes. Colour is backed by a `+`/`−` character and a screen-reader label, so
 * the diff survives both a monochrome screen and colour-vision deficiency.
 */
export function SoSanhMa({
  cu,
  moi,
  nhanCu,
  nhanMoi,
}: {
  cu: string;
  moi: string;
  nhanCu: string;
  nhanMoi: string;
}) {
  const dong = useMemo(() => soSanhDong(cu, moi), [cu, moi]);
  const soThem = dong.filter((d) => d.loai === 'them').length;
  const soBot = dong.filter((d) => d.loai === 'bot').length;

  return (
    <div>
      <p className="mt-0 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-chu-phu">
          So sánh <strong className="text-chu">{nhanCu}</strong> với{' '}
          <strong className="text-chu">{nhanMoi}</strong>
        </span>
        <span className="text-dung">+{soThem} dòng</span>
        <span className="text-thu-lai">−{soBot} dòng</span>
      </p>

      {soThem === 0 && soBot === 0 ? (
        <p className="m-0 rounded-nut border border-vien bg-the-mo p-4 text-sm text-chu-phu">
          Hai bản này giống hệt nhau.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-nut border border-vien">
          <table className="w-full border-collapse font-mono text-sm">
            <caption className="sr-only">
              Khác biệt giữa {nhanCu} và {nhanMoi}
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Dòng bản cũ</th>
                <th scope="col">Dòng bản mới</th>
                <th scope="col">Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {dong.map((d, i) => {
                const kieu = KIEU_DONG[d.loai];
                return (
                  <tr key={i} className={kieu.nen}>
                    <td className="w-12 border-e border-vien px-2 py-0.5 text-end text-xs text-chu-nhat tabular-nums select-none">
                      {d.soCu ?? ''}
                    </td>
                    <td className="w-12 border-e border-vien px-2 py-0.5 text-end text-xs text-chu-nhat tabular-nums select-none">
                      {d.soMoi ?? ''}
                    </td>
                    <td className="px-3 py-0.5 whitespace-pre-wrap">
                      <span aria-hidden="true" className="me-2 select-none text-chu-nhat">
                        {kieu.dau}
                      </span>
                      {kieu.doc ? <span className="sr-only">{kieu.doc}: </span> : null}
                      {d.chu === '' ? ' ' : d.chu}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
