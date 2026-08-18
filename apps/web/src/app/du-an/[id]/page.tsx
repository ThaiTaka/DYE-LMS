import { GIOI_HAN_DU_AN_BYTE } from '@dye/core';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { KhuDuAn, NopMoc } from '@/components/du-an/khu-du-an';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { VoHocSinh } from '@/components/hoc-sinh/vo';
import { requireSession, xemDuoc } from '@/lib/guard';
import { khongGianLamViec, NHAN_TRANG_THAI } from '@/lib/project-data';

export default async function TrangKhongGianDuAn({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireSession();
  const { id } = await params;

  // A viewer with no relationship to this student is refused with a real page,
  // not an HTTP 500 — the same rule established in Phase 6.
  const kq = await xemDuoc(khongGianLamViec(actor, id));
  if (!kq.ok) redirect('/khong-co-quyen');

  const kg = kq.du;
  if (!kg) notFound();

  const tt = NHAN_TRANG_THAI[kg.duAn.status];

  return (
    <VoHocSinh tenHienThi={actor.displayName}>
      <DuongDan
        muc={[
          { nhan: 'Trang chính', href: '/bang-dieu-khien' },
          { nhan: 'Dự án game', href: '/du-an' },
          { nhan: kg.duAn.title },
        ]}
      />

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-3xl font-bold">{kg.duAn.title}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tt.lop}`}>
            {tt.nhan}
          </span>
        </div>
        <p className="m-0 text-chu-phu">
          {kg.duAn.description} · đang làm ở bản {kg.ban.version}
          {!kg.suaDuoc ? ` · bài của ${kg.duAn.tenHocSinh}` : ''}
        </p>
      </header>

      <div className="mb-8">
        <KhuDuAn
          projectId={kg.duAn.id}
          tepBanDau={kg.tep}
          tongByte={kg.tongByte}
          gioiHanByte={GIOI_HAN_DU_AN_BYTE}
          suaDuoc={kg.suaDuoc}
        />
      </div>

      {kg.suaDuoc ? (
        <div className="mb-8">
          <NopMoc projectId={kg.duAn.id} />
        </div>
      ) : null}

      {/*
        Running the game: the honest state.

        Browser execution of Pygame needs a WASM build toolchain per project;
        it is a build pipeline, not a feature flag. Rather than shipping a
        preview that half-works and confuses a child about whether their game is
        broken, the workspace hands them a file they can actually run.
      */}
      <section
        aria-labelledby="chay-thu"
        className="mb-8 rounded-the border border-vien bg-the p-5"
      >
        <h2 id="chay-thu" className="mt-0 mb-2 text-lg font-bold">
          🎮 Chạy thử trò chơi
        </h2>
        <p className="mt-0 mb-4 text-chu-phu">
          Em tải dự án về máy rồi chạy bằng Python có cài Pygame. Chạy ngay trên trình duyệt là
          tính năng đang được xây — khi có, nút sẽ hiện ở đây.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/du-an/${kg.duAn.id}/tai-ve`}
            className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
          >
            ⬇ Tải về để chơi
          </a>
          <code className="rounded-nut bg-the-mo px-3 py-2 font-mono text-sm">
            python main.py
          </code>
        </div>
      </section>

      {kg.daNop.length > 0 ? (
        <section aria-labelledby="lich-su-nop">
          <h2 id="lich-su-nop" className="mt-0 mb-4 text-xl font-bold">
            Các bản em đã nộp ({kg.daNop.length})
          </h2>

          <ul className="m-0 list-none space-y-3 p-0">
            {kg.daNop.map((b) => (
              <li key={b.versionId} className="rounded-the border border-vien bg-the p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-semibold">Bản {b.version}</span>
                  <span className="text-sm text-chu-nhat">
                    {b.submittedAt.toLocaleString('vi-VN')} · {b.soTep} tệp
                  </span>
                </div>

                {b.note ? <p className="mt-2 mb-0 text-sm text-chu-phu">“{b.note}”</p> : null}

                {b.nhanXet.length > 0 ? (
                  <ul className="m-0 mt-3 list-none space-y-2 border-t border-vien p-0 pt-3">
                    {b.nhanXet.map((n) => (
                      <li key={n.id} className="rounded-nut bg-chinh-nhat p-3 text-sm">
                        <p className="mt-0 mb-1 font-semibold text-chinh">
                          💬 {n.tenGiaoVien} nhận xét
                        </p>
                        <p className="m-0 whitespace-pre-wrap">{n.comment}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 mb-0 text-sm text-chu-nhat">Thầy cô chưa nhận xét bản này.</p>
                )}

                <p className="mt-3 mb-0">
                  <Link
                    href={`/api/du-an/${kg.duAn.id}/tai-ve?ban=${b.version}`}
                    className="text-sm text-chinh underline underline-offset-2"
                  >
                    ⬇ Tải bản {b.version} (.zip)
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </VoHocSinh>
  );
}
