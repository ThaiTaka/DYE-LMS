'use client';

// From the `/upload-guard` subpath, not the package root. The root barrel
// re-exports modules that import `node:crypto`, which cannot be bundled for the
// browser. This module is pure byte inspection with no Node dependency at all.
import { DINH_DANG_CHO_PHEP } from '@dye/core/upload-guard';
import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';

import {
  CHUA_LAM,
  docTepDeSua,
  luuTepVanBan,
  nopMocDuAn,
  taiTepLen,
  xoaTepDuAn,
} from '@/app/du-an/actions';
import { SoanThao } from '@/components/hoc-sinh/soan-thao';

import { CayTep, coChu } from './cay-tep';

import type { TepDuAn } from '@dye/core';

const CHO_PHEP = DINH_DANG_CHO_PHEP.map((d) => `.${d.duoi}`).join(',');

export interface KhuDuAnProps {
  projectId: string;
  tepBanDau: TepDuAn[];
  tongByte: number;
  gioiHanByte: number;
  suaDuoc: boolean;
}

/**
 * The student's project workspace.
 *
 * File tree, uploader, and the Phase 7 CodeMirror editor for `.py` and other
 * text files. Binary assets are previewed rather than opened — a student
 * clicking `player.png` should see their sprite, not a screen of bytes.
 */
export function KhuDuAn({
  projectId,
  tepBanDau,
  tongByte,
  gioiHanByte,
  suaDuoc,
}: KhuDuAnProps) {
  const [tep, setTep] = useState(tepBanDau);
  const [chon, setChon] = useState<TepDuAn | null>(null);
  const [code, setCode] = useState('');
  const [dangTai, setDangTai] = useState(false);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [chiTiet, setChiTiet] = useState<Array<{ ten: string; ok: boolean; lyDo: string }>>([]);
  const [dangGui, batDau] = useTransition();

  const id = useId();
  const oTepRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setTep(tepBanDau), [tepBanDau]);

  const moTep = useCallback(
    async (t: TepDuAn) => {
      setChon(t);
      setCode('');
      if (!t.suaDuoc) return;

      setDangTai(true);
      const kq = await docTepDeSua(projectId, t.id);
      setDangTai(false);
      setCode(kq?.code ?? '');
    },
    [projectId],
  );

  const chay = useCallback(
    (viec: () => Promise<{ trangThai: string; thongDiep: string }>) => {
      batDau(async () => {
        const kq = await viec();
        setThongBao({ ok: kq.trangThai === 'thanh-cong', chu: kq.thongDiep });
      });
    },
    [],
  );

  const taiLen = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fd = new FormData();
      fd.set('projectId', projectId);
      for (const f of Array.from(files)) fd.append('files', f);

      batDau(async () => {
        const kq = await taiTepLen({ ...CHUA_LAM, chiTiet: [] }, fd);
        setThongBao({ ok: kq.trangThai === 'thanh-cong', chu: kq.thongDiep });
        // Per-file reasons, so a rejected asset says why rather than vanishing.
        setChiTiet(kq.chiTiet.filter((c) => !c.ok));
        if (oTepRef.current) oTepRef.current.value = '';
      });
    },
    [projectId],
  );

  const phanTramDung = Math.min(100, Math.round((tongByte / gioiHanByte) * 100));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* ── Files ──────────────────────────────────────────────────────── */}
      <aside className="rounded-the border border-vien bg-the p-4">
        <h2 className="mt-0 mb-3 text-base font-bold">Tệp trong dự án ({tep.length})</h2>

        <CayTep
          tep={tep}
          dangChon={chon?.path ?? null}
          onChon={(t) => void moTep(t)}
          onXoa={(duongDan) => {
            const fd = new FormData();
            fd.set('projectId', projectId);
            fd.set('duongDan', duongDan);
            chay(() => xoaTepDuAn(CHUA_LAM, fd));
            setTep((cu) => cu.filter((t) => t.path !== duongDan));
            if (chon?.path === duongDan) setChon(null);
          }}
          suaDuoc={suaDuoc}
        />

        <div className="mt-4 border-t border-vien pt-4">
          <p className="mt-0 mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-semibold">Dung lượng</span>
            <span className="text-chu-phu tabular-nums">
              {coChu(tongByte)} / {coChu(gioiHanByte)}
            </span>
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={phanTramDung}
            aria-label="Dung lượng dự án đã dùng"
            className="h-2 w-full overflow-hidden rounded-full bg-the-mo"
          >
            <div
              className={`h-full rounded-full ${phanTramDung > 90 ? 'bg-thu-lai' : 'bg-chinh'}`}
              style={{ width: `${phanTramDung}%` }}
            />
          </div>
        </div>

        {suaDuoc ? (
          <div className="mt-4 border-t border-vien pt-4">
            <label htmlFor={`${id}-tai`} className="mb-1.5 block text-sm font-semibold">
              Tải tài nguyên lên
            </label>
            <input
              id={`${id}-tai`}
              ref={oTepRef}
              type="file"
              multiple
              accept={CHO_PHEP}
              onChange={(e) => taiLen(e.target.files)}
              disabled={dangGui}
              className="block w-full text-sm file:me-3 file:min-h-cham file:rounded-nut file:border-0 file:bg-chinh file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-chinh-dam"
            />
            <p className="mt-2 mb-0 text-xs text-chu-nhat">
              Ảnh, âm thanh, .py, .json — mỗi tệp tối đa 5 MB.
            </p>

            <TaoTepMoi projectId={projectId} onXong={(kq) => setThongBao(kq)} />
          </div>
        ) : null}
      </aside>

      {/* ── Editor / preview ───────────────────────────────────────────── */}
      <section className="min-w-0">
        {thongBao ? (
          <p
            role="status"
            className={`mb-4 rounded-nut p-3 text-sm ${
              thongBao.ok ? 'bg-dung-nen text-dung' : 'bg-thu-lai-nen text-thu-lai'
            }`}
          >
            <span aria-hidden="true">{thongBao.ok ? '✓ ' : '! '}</span>
            {thongBao.chu}
          </p>
        ) : null}

        {chiTiet.length > 0 ? (
          <ul className="m-0 mb-4 list-none space-y-1 rounded-nut bg-thu-lai-nen p-3 text-sm">
            {chiTiet.map((c) => (
              <li key={c.ten} className="text-thu-lai">
                <strong>{c.ten}</strong> — {c.lyDo}
              </li>
            ))}
          </ul>
        ) : null}

        {chon === null ? (
          <p className="m-0 rounded-the border border-vien bg-the p-6 text-chu-phu">
            Chọn một tệp bên trái để xem hoặc sửa.
          </p>
        ) : chon.suaDuoc ? (
          <SuaTep
            key={chon.id}
            projectId={projectId}
            tep={chon}
            code={code}
            dangTai={dangTai}
            onDoi={setCode}
            suaDuoc={suaDuoc}
            onLuu={() => {
              const fd = new FormData();
              fd.set('projectId', projectId);
              fd.set('duongDan', chon.path);
              fd.set('code', code);
              chay(() => luuTepVanBan(CHUA_LAM, fd));
            }}
          />
        ) : (
          <XemTaiNguyen projectId={projectId} tep={chon} />
        )}
      </section>
    </div>
  );
}

function SuaTep({
  tep,
  code,
  dangTai,
  onDoi,
  onLuu,
  suaDuoc,
}: {
  projectId: string;
  tep: TepDuAn;
  code: string;
  dangTai: boolean;
  onDoi: (s: string) => void;
  onLuu: () => void;
  suaDuoc: boolean;
}) {
  return (
    <div className="rounded-the border border-vien bg-the">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vien px-4 py-2.5">
        <span className="font-mono text-sm font-semibold">{tep.path}</span>
        {suaDuoc ? (
          <button
            type="button"
            onClick={onLuu}
            className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam"
          >
            Lưu tệp
          </button>
        ) : (
          <span className="text-sm text-chu-nhat">Chỉ xem</span>
        )}
      </div>

      {dangTai ? (
        <p className="m-0 p-6 text-chu-phu">Đang mở tệp…</p>
      ) : (
        <SoanThao giaTri={code} onDoi={onDoi} nhan={`Nội dung ${tep.path}`} chiDoc={!suaDuoc} />
      )}
    </div>
  );
}

/**
 * Preview a binary asset.
 *
 * Images and audio render through the authorized route handler, which serves
 * them with `nosniff` and a sandboxed CSP. A student seeing their own sprite is
 * the point of an asset manager.
 */
function XemTaiNguyen({ projectId, tep }: { projectId: string; tep: TepDuAn }) {
  const url = `/api/du-an/${projectId}/tep/${tep.id}`;
  const laAnh = tep.sniffedMime.startsWith('image/');
  const laAmThanh = tep.sniffedMime.startsWith('audio/');

  return (
    <div className="rounded-the border border-vien bg-the">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vien px-4 py-2.5">
        <span className="font-mono text-sm font-semibold">{tep.path}</span>
        <span className="text-sm text-chu-nhat">
          {tep.sniffedMime} · {coChu(tep.sizeBytes)}
        </span>
      </div>

      <div className="p-6">
        {laAnh ? (
          <img
            src={url}
            alt={`Xem trước ${tep.path}`}
            className="max-h-96 max-w-full rounded-nut border border-vien bg-the-mo object-contain"
          />
        ) : laAmThanh ? (
          // No caption track: these are game sound effects a student recorded or
          // downloaded, not speech, so there is nothing to caption.
          <audio controls src={url} className="w-full">
            Trình duyệt của em chưa phát được tệp âm thanh này.
          </audio>
        ) : (
          <p className="m-0 text-chu-phu">Không xem trước được định dạng này.</p>
        )}

        <p className="mt-4 mb-0">
          <a
            href={url}
            download
            className="inline-flex min-h-cham items-center gap-2 rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
          >
            ⬇ Tải tệp này về
          </a>
        </p>
      </div>
    </div>
  );
}

function TaoTepMoi({
  projectId,
  onXong,
}: {
  projectId: string;
  onXong: (kq: { ok: boolean; chu: string }) => void;
}) {
  const [ten, setTen] = useState('');
  const [dangGui, batDau] = useTransition();
  const id = useId();

  return (
    <div className="mt-4">
      <label htmlFor={`${id}-ten`} className="mb-1.5 block text-sm font-semibold">
        Tạo tệp mới
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-ten`}
          value={ten}
          onChange={(e) => setTen(e.target.value)}
          placeholder="main.py"
          className="min-h-cham min-w-0 flex-1 rounded-nut border border-vien bg-the px-3 py-2 font-mono text-sm"
        />
        <button
          type="button"
          disabled={dangGui || ten.trim() === ''}
          onClick={() => {
            const fd = new FormData();
            fd.set('projectId', projectId);
            fd.set('duongDan', ten.trim());
            fd.set('code', '# Trò chơi của em\nimport pygame\n');
            batDau(async () => {
              const kq = await luuTepVanBan(CHUA_LAM, fd);
              onXong({ ok: kq.trangThai === 'thanh-cong', chu: kq.thongDiep });
              if (kq.trangThai === 'thanh-cong') setTen('');
            });
          }}
          className="min-h-cham rounded-nut border border-vien px-3 py-2 text-sm font-semibold text-chu-phu hover:border-chinh hover:text-chinh disabled:opacity-50"
        >
          Tạo
        </button>
      </div>
    </div>
  );
}

/** Submit the current working copy as a milestone. */
export function NopMoc({ projectId }: { projectId: string }) {
  const [note, setNote] = useState('');
  const [kq, setKq] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGui, batDau] = useTransition();
  const id = useId();

  return (
    <section
      aria-labelledby={`${id}-nop`}
      className="rounded-the border border-vien bg-the p-5"
    >
      <h2 id={`${id}-nop`} className="mt-0 mb-1 text-lg font-bold">
        Nộp mốc cho thầy cô
      </h2>
      <p className="mt-0 mb-4 text-sm text-chu-phu">
        Bản em nộp được giữ nguyên để thầy cô xem và nhận xét. Em vẫn tiếp tục sửa được ở bản mới,
        không mất gì cả.
      </p>

      <label htmlFor={`${id}-note`} className="mb-1.5 block text-sm font-semibold">
        Em muốn nói gì với thầy cô về bản này?
      </label>
      <textarea
        id={`${id}-note`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="ví dụ: Em đã làm xong phần di chuyển, còn phần tính điểm em chưa biết làm."
        className="mb-3 w-full rounded-nut border border-vien bg-the p-3 text-base"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={dangGui}
          onClick={() => {
            const fd = new FormData();
            fd.set('projectId', projectId);
            fd.set('note', note);
            batDau(async () => {
              const r = await nopMocDuAn(CHUA_LAM, fd);
              setKq({ ok: r.trangThai === 'thanh-cong', chu: r.thongDiep });
              if (r.trangThai === 'thanh-cong') setNote('');
            });
          }}
          className="min-h-cham rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
        >
          {dangGui ? 'Đang nộp…' : '📤 Nộp mốc này'}
        </button>

        <a
          href={`/api/du-an/${projectId}/tai-ve`}
          className="inline-flex min-h-cham items-center gap-2 rounded-nut border border-vien px-4 py-2.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
        >
          ⬇ Tải cả dự án (.zip)
        </a>

        {kq ? (
          <p
            role="status"
            className={`m-0 text-sm font-medium ${kq.ok ? 'text-dung' : 'text-thu-lai'}`}
          >
            {kq.chu}
          </p>
        ) : null}
      </div>
    </section>
  );
}
