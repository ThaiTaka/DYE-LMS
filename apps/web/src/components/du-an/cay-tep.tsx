'use client';

import { useMemo } from 'react';

import type { TepDuAn } from '@dye/core';

/** Icon per file kind, so the tree is scannable without reading extensions. */
function bieuTuong(path: string): string {
  const duoi = path.split('.').pop()?.toLowerCase() ?? '';
  if (duoi === 'py') return '🐍';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(duoi)) return '🖼️';
  if (['wav', 'ogg', 'mp3'].includes(duoi)) return '🔊';
  if (['json', 'csv'].includes(duoi)) return '📋';
  return '📄';
}

export function coChu(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

interface Nut {
  ten: string;
  duongDan: string;
  tep: TepDuAn | null;
  con: Nut[];
}

/**
 * Group flat paths into a folder tree.
 *
 * Files are stored with a flat `assets/player.png` path — there is no folder
 * table, because a folder with nothing in it has nothing to store. The tree is
 * derived for display, which also means an empty folder simply cannot exist and
 * confuse a student.
 */
function dungCay(tep: TepDuAn[]): Nut[] {
  const goc: Nut = { ten: '', duongDan: '', tep: null, con: [] };

  for (const t of tep) {
    const phan = t.path.split('/');
    let hienTai = goc;

    for (const [i, p] of phan.entries()) {
      const laTep = i === phan.length - 1;
      const duongDan = phan.slice(0, i + 1).join('/');

      let nut = hienTai.con.find((c) => c.ten === p && (c.tep === null) !== laTep);
      if (!nut) {
        nut = { ten: p, duongDan, tep: laTep ? t : null, con: [] };
        hienTai.con.push(nut);
      }
      hienTai = nut;
    }
  }

  const sapXep = (n: Nut): void => {
    // Folders first, then alphabetical — the order a file explorer trains
    // people to expect.
    n.con.sort((a, b) => {
      const aThuMuc = a.tep === null;
      const bThuMuc = b.tep === null;
      if (aThuMuc !== bThuMuc) return aThuMuc ? -1 : 1;
      return a.ten.localeCompare(b.ten, 'vi');
    });
    n.con.forEach(sapXep);
  };
  sapXep(goc);

  return goc.con;
}

export function CayTep({
  tep,
  dangChon,
  onChon,
  onXoa,
  suaDuoc,
}: {
  tep: TepDuAn[];
  dangChon: string | null;
  onChon: (t: TepDuAn) => void;
  onXoa: (duongDan: string) => void;
  suaDuoc: boolean;
}) {
  const cay = useMemo(() => dungCay(tep), [tep]);

  if (tep.length === 0) {
    return (
      <p className="m-0 rounded-nut border border-vien bg-the-mo p-4 text-sm text-chu-phu">
        Dự án chưa có tệp nào. Em tạo <code>main.py</code> hoặc tải ảnh, âm thanh lên nhé.
      </p>
    );
  }

  return (
    <ul className="m-0 list-none space-y-0.5 p-0" role="tree" aria-label="Tệp trong dự án">
      {cay.map((n) => (
        <NutCay
          key={n.duongDan}
          nut={n}
          cap={0}
          dangChon={dangChon}
          onChon={onChon}
          onXoa={onXoa}
          suaDuoc={suaDuoc}
        />
      ))}
    </ul>
  );
}

function NutCay({
  nut,
  cap,
  dangChon,
  onChon,
  onXoa,
  suaDuoc,
}: {
  nut: Nut;
  cap: number;
  dangChon: string | null;
  onChon: (t: TepDuAn) => void;
  onXoa: (duongDan: string) => void;
  suaDuoc: boolean;
}) {
  const thut = { paddingInlineStart: `${cap * 1.1 + 0.5}rem` };

  if (nut.tep === null) {
    return (
      <li role="treeitem" aria-expanded="true">
        <div
          className="flex min-h-cham items-center gap-2 py-1 text-sm font-semibold text-chu-phu"
          style={thut}
        >
          <span aria-hidden="true">📁</span>
          {nut.ten}
        </div>
        <ul className="m-0 list-none space-y-0.5 p-0" role="group">
          {nut.con.map((c) => (
            <NutCay
              key={c.duongDan}
              nut={c}
              cap={cap + 1}
              dangChon={dangChon}
              onChon={onChon}
              onXoa={onXoa}
              suaDuoc={suaDuoc}
            />
          ))}
        </ul>
      </li>
    );
  }

  const t = nut.tep;
  const chon = dangChon === t.path;

  return (
    <li role="treeitem" aria-selected={chon}>
      <div
        className={`flex min-h-cham items-center gap-2 rounded-nut py-1 pe-2 ${
          chon ? 'bg-chinh-nhat' : 'hover:bg-the-mo'
        }`}
        style={thut}
      >
        <button
          type="button"
          onClick={() => onChon(t)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-start text-sm ${
            chon ? 'font-semibold text-chinh' : 'text-chu'
          }`}
        >
          <span aria-hidden="true">{bieuTuong(t.path)}</span>
          <span className="truncate">{nut.ten}</span>
          <span className="ms-auto shrink-0 text-xs text-chu-nhat tabular-nums">
            {coChu(t.sizeBytes)}
          </span>
        </button>

        {suaDuoc ? (
          <button
            type="button"
            onClick={() => onXoa(t.path)}
            aria-label={`Xoá ${t.path}`}
            className="shrink-0 rounded p-1.5 text-sm text-chu-nhat hover:text-thu-lai"
          >
            <span aria-hidden="true">✕</span>
          </button>
        ) : null}
      </div>
    </li>
  );
}
