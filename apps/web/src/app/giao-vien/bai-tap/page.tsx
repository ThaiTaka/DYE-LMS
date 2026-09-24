import Link from 'next/link';

import { TaoBaiTap } from '@/components/giao-vien/tao-bai-tap';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { SAC_THAI } from '@/components/ui/sac-thai';
import { requireRole } from '@/lib/guard';
import { duLieuBaiTapGiaoVien } from '@/lib/teacher-data';
import { hienThiHan, thanhGioViecNam } from '@/lib/thoi-gian';

const NGAY_MS = 24 * 60 * 60 * 1000;

/**
 * Homework: set a new one, and see every one already set with its hand-ins.
 *
 * The form opens by itself for a teacher who has not set anything yet — an
 * empty list under a closed button reads as "this feature is not here".
 */
export default async function TrangBaiTapGiaoVien() {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { lop, baiTap } = await duLieuBaiTapGiaoVien(actor);

  /*
   * The form's default and minimum deadline, computed HERE rather than in the
   * client component: rendered on both sides, a `min` of "now" would differ
   * by a minute between the server's HTML and the browser's hydration.
   * Default: a week from today, 20:00 — after dinner, before bed.
   */
  const bayGio = new Date();
  const hanToiThieu = thanhGioViecNam(bayGio);
  const hanMacDinh = `${thanhGioViecNam(new Date(bayGio.getTime() + 7 * NGAY_MS)).slice(0, 10)}T20:00`;

  return (
    <VoGiaoVien
      tenHienThi={actor.displayName}
      vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}
    >
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Bài tập về nhà' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Bài tập về nhà</h1>
        <p className="m-0 text-chu-phu">
          Bài tập code thầy cô tự soạn, giao cho một lớp, có hạn nộp. Máy không chấm bài này — thầy
          cô đọc và nhận xét.{' '}
          {actor.role === 'ADMIN'
            ? 'Trang này hiện bài của mọi lớp.'
            : 'Trang này chỉ hiện các lớp thầy cô phụ trách.'}
        </p>
      </header>

      <TaoBaiTap
        lop={lop}
        hanMacDinh={hanMacDinh}
        hanToiThieu={hanToiThieu}
        moSan={baiTap.length === 0}
      />

      <section aria-labelledby="da-giao">
        <h2 id="da-giao" className="mt-0 mb-4 text-xl font-bold">
          Đã giao ({baiTap.length})
        </h2>

        {baiTap.length === 0 ? (
          <p className="m-0 rounded-nut border border-white/10 bg-the p-4 text-chu-phu">
            Chưa có bài tập nào. Bài thầy cô giao sẽ hiện ở đây cùng số em đã nộp.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {baiTap.map((b) => {
              const quaHan = new Date(b.hanNop).getTime() < bayGio.getTime();
              const tiLe = b.soHocSinh > 0 ? Math.round((b.soDaNop / b.soHocSinh) * 100) : 0;
              return (
                <li key={b.id}>
                  <Link
                    href={`/giao-vien/bai-tap/${b.id}`}
                    className="group grid gap-3 rounded-the-nho border border-white/10 bg-the p-4 transition-colors hover:border-chinh-sang/60 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center sm:p-5"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="m-0 text-base font-semibold text-chu group-hover:text-chinh-sang">
                          {b.tieuDe}
                        </h3>
                        {b.soChoCham > 0 ? (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.thuLai}`}
                          >
                            {b.soChoCham} bài chờ chấm
                          </span>
                        ) : null}
                        {quaHan ? (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.trung}`}
                          >
                            Đã qua hạn
                          </span>
                        ) : null}
                      </div>
                      <p className="m-0 text-sm text-chu-phu">
                        {b.tenLop}
                        {b.baiHoc ? ` · sau Buổi ${b.baiHoc.buoi}` : ''} · Hạn{' '}
                        <span className="whitespace-nowrap">{hienThiHan(b.hanNop)}</span>
                        {actor.role === 'ADMIN' ? ` · ${b.tacGia}` : ''}
                      </p>
                    </div>

                    <div>
                      <p className="mt-0 mb-1.5 flex justify-between text-sm">
                        <span className="text-chu-phu">Đã nộp</span>
                        <span className="font-semibold tabular-nums">
                          {b.soDaNop}/{b.soHocSinh}
                        </span>
                      </p>
                      <div
                        role="progressbar"
                        aria-label={`Đã nộp ${b.tieuDe}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={tiLe}
                        aria-valuetext={`${b.soDaNop} trên ${b.soHocSinh} em`}
                        className="h-2 overflow-hidden rounded-full bg-white/[0.08]"
                      >
                        <div
                          className="h-full rounded-full bg-linear-to-r from-chinh to-hong"
                          style={{ width: `${tiLe}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </VoGiaoVien>
  );
}
