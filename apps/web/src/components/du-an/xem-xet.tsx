'use client';

import { useCallback, useId, useState, useTransition } from 'react';

import { CHUA_LAM, docTepDeSua, nhanXetDuAn } from '@/app/du-an/actions';
import { SoanThao } from '@/components/hoc-sinh/soan-thao';

import { CayTep, coChu } from './cay-tep';

import type { TepDuAn } from '@dye/core';

export interface NhanXetCu {
  id: string;
  comment: string;
  tenGiaoVien: string;
  luc: string;
}

const LUA_CHON: Array<{ giaTri: string; nhan: string; moTa: string; lop: string }> = [
  {
    giaTri: 'APPROVED',
    nhan: 'Duyệt',
    moTa: 'Bản này đạt yêu cầu của mốc.',
    lop: 'border-dung bg-dung-nen',
  },
  {
    giaTri: 'CHANGES_REQUESTED',
    nhan: 'Cần chỉnh thêm',
    moTa: 'Em cần sửa hoặc bổ sung rồi nộp lại.',
    lop: 'border-thu-lai bg-thu-lai-nen',
  },
  {
    giaTri: 'IN_REVIEW',
    nhan: 'Đang xem tiếp',
    moTa: 'Thầy cô ghi chú lại, chưa kết luận.',
    lop: 'border-vien bg-the',
  },
];

/**
 * Teacher review of one submitted version.
 *
 * The code is shown read-only. A teacher who could edit the file would be
 * changing a child's submitted work under their own name, and the feedback would
 * then refer to something the student never wrote.
 */
export function XemXetDuAn({
  projectId,
  versionId,
  version,
  tep,
  nhanXetCu,
}: {
  projectId: string;
  versionId: string;
  version: number;
  tep: TepDuAn[];
  nhanXetCu: NhanXetCu[];
}) {
  const [chon, setChon] = useState<TepDuAn | null>(null);
  const [code, setCode] = useState('');
  const [dangTai, setDangTai] = useState(false);
  const [comment, setComment] = useState('');
  const [kq, setKq] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGui, batDau] = useTransition();
  const id = useId();

  const moTep = useCallback(
    async (t: TepDuAn) => {
      setChon(t);
      setCode('');
      if (!t.suaDuoc) return;

      setDangTai(true);
      const r = await docTepDeSua(projectId, t.id);
      setDangTai(false);
      setCode(r?.code ?? '');
    },
    [projectId],
  );

  const gui = useCallback(
    (trangThai: string) => {
      const fd = new FormData();
      fd.set('versionId', versionId);
      fd.set('comment', comment);
      fd.set('trangThai', trangThai);

      batDau(async () => {
        const r = await nhanXetDuAn(CHUA_LAM, fd);
        setKq({ ok: r.trangThai === 'thanh-cong', chu: r.thongDiep });
        if (r.trangThai === 'thanh-cong') setComment('');
      });
    },
    [comment, versionId],
  );

  return (
    <>
      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <aside className="rounded-the border border-vien bg-the p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-base font-bold">Tệp ({tep.length})</h2>
            <a
              href={`/api/du-an/${projectId}/tai-ve?ban=${version}`}
              className="rounded-nut border border-vien px-3 py-1.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
            >
              ⬇ Tải .zip
            </a>
          </div>

          <CayTep
            tep={tep}
            dangChon={chon?.path ?? null}
            onChon={(t) => void moTep(t)}
            onXoa={() => undefined}
            suaDuoc={false}
          />
        </aside>

        <section className="min-w-0">
          {chon === null ? (
            <p className="m-0 rounded-the border border-vien bg-the p-6 text-chu-phu">
              Chọn một tệp bên trái để đọc code hoặc xem tài nguyên.
            </p>
          ) : chon.suaDuoc ? (
            <div className="rounded-the border border-vien bg-the">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-vien px-4 py-2.5">
                <span className="font-mono text-sm font-semibold">{chon.path}</span>
                <span className="text-sm text-chu-nhat">Chỉ đọc</span>
              </div>
              {dangTai ? (
                <p className="m-0 p-6 text-chu-phu">Đang mở tệp…</p>
              ) : (
                <SoanThao
                  key={chon.id}
                  giaTri={code}
                  onDoi={() => undefined}
                  nhan={`Nội dung ${chon.path}`}
                  chiDoc
                />
              )}
            </div>
          ) : (
            <XemTaiNguyen projectId={projectId} tep={chon} />
          )}
        </section>
      </div>

      {/* ── Feedback ───────────────────────────────────────────────────── */}
      <section
        aria-labelledby={`${id}-nx`}
        className="rounded-the border border-vien bg-the p-5 sm:p-6"
      >
        <h2 id={`${id}-nx`} className="mt-0 mb-1 text-lg font-bold">
          Nhận xét cho học sinh
        </h2>
        <p className="mt-0 mb-4 text-sm text-chu-phu">
          Em học sinh sẽ đọc được nguyên văn phần này trong trang dự án của mình.
        </p>

        <label htmlFor={`${id}-comment`} className="mb-1.5 block text-sm font-semibold">
          Nội dung nhận xét
        </label>
        <textarea
          id={`${id}-comment`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={5}
          placeholder="Nêu cụ thể em đã làm được gì, và bước tiếp theo nên làm gì."
          className="mb-4 w-full rounded-nut border border-vien bg-the p-3 text-base"
        />

        <fieldset className="m-0 mb-4 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold">Kết luận cho bản này</legend>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {LUA_CHON.map((l) => (
              <button
                key={l.giaTri}
                type="button"
                disabled={dangGui || comment.trim().length < 3}
                onClick={() => gui(l.giaTri)}
                className={`min-h-cham rounded-nut border-2 p-3.5 text-start disabled:opacity-50 ${l.lop}`}
              >
                <span className="block font-semibold">{l.nhan}</span>
                <span className="mt-0.5 block text-sm text-chu-phu">{l.moTa}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {comment.trim().length < 3 ? (
          <p className="m-0 text-sm text-chu-nhat">
            Thầy cô viết vài dòng nhận xét trước khi chọn kết luận nhé.
          </p>
        ) : null}

        {kq ? (
          <p
            role="status"
            className={`m-0 mt-3 text-sm font-medium ${kq.ok ? 'text-dung' : 'text-thu-lai'}`}
          >
            {kq.chu}
          </p>
        ) : null}

        {nhanXetCu.length > 0 ? (
          <div className="mt-6 border-t border-vien pt-4">
            <h3 className="mt-0 mb-3 text-base font-bold">Nhận xét trước đó</h3>
            <ul className="m-0 list-none space-y-2 p-0">
              {nhanXetCu.map((n) => (
                <li key={n.id} className="rounded-nut bg-the-mo p-3 text-sm">
                  <p className="mt-0 mb-1 font-semibold">
                    {n.tenGiaoVien}
                    <span className="ms-2 font-normal text-chu-nhat">
                      {new Date(n.luc).toLocaleString('vi-VN')}
                    </span>
                  </p>
                  <p className="m-0 whitespace-pre-wrap">{n.comment}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}

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
          <audio controls src={url} className="w-full">
            Trình duyệt chưa phát được tệp âm thanh này.
          </audio>
        ) : (
          <p className="m-0 text-chu-phu">Không xem trước được định dạng này.</p>
        )}
      </div>
    </div>
  );
}
