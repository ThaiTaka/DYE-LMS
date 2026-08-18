import { MAU_DU_AN } from '@dye/core';
import Link from 'next/link';

import { TaoDuAnForm } from '@/components/du-an/tao-du-an';
import { VoHocSinh } from '@/components/hoc-sinh/vo';
import { requireRole } from '@/lib/guard';
import { duAnCuaEm, NHAN_TRANG_THAI } from '@/lib/project-data';

function coChu(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

export default async function TrangDuAn() {
  const actor = await requireRole('STUDENT');
  const duAn = await duAnCuaEm(actor.id);

  return (
    <VoHocSinh tenHienThi={actor.displayName}>
      <header className="mb-7">
        <h1 className="mt-0 mb-2 text-3xl font-bold sm:text-4xl">Dự án game của em 🎮</h1>
        <p className="m-0 text-chu-phu">
          Nơi em xây trò chơi của riêng mình qua 30 buổi học. Em viết code, tải ảnh và âm thanh
          lên, rồi nộp cho thầy cô xem bất cứ lúc nào.
        </p>
      </header>

      {duAn.length > 0 ? (
        <section aria-labelledby="ds-du-an" className="mb-8">
          <h2 id="ds-du-an" className="mt-0 mb-4 text-xl font-bold">
            Dự án đang làm
          </h2>

          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
            {duAn.map((d) => {
              const tt = NHAN_TRANG_THAI[d.status];
              return (
                <li key={d.id}>
                  <Link
                    href={`/du-an/${d.id}`}
                    className="block h-full rounded-the border border-vien bg-the p-5 transition-colors hover:border-chinh"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <h3 className="m-0 text-lg leading-snug font-semibold text-chu">
                        {d.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tt.lop}`}
                      >
                        {tt.nhan}
                      </span>
                    </div>

                    <p className="mt-0 mb-3 text-sm text-chu-phu">{d.description}</p>

                    <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-chu-nhat">
                      <span>
                        {d.soTep} tệp · {coChu(d.tongByte)}
                      </span>
                      <span>Bản {d.banHienTai}</span>
                      {d.soLanNop > 0 ? <span>Đã nộp {d.soLanNop} lần</span> : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="tao-moi" className="rounded-the border border-vien bg-the p-5 sm:p-6">
        <h2 id="tao-moi" className="mt-0 mb-1 text-xl font-bold">
          {duAn.length === 0 ? 'Bắt đầu dự án đầu tiên' : 'Tạo dự án mới'}
        </h2>
        <p className="mt-0 mb-5 text-sm text-chu-phu">
          Em chọn một kiểu trò chơi để bắt đầu. Chọn kiểu nào cũng được — em vẫn đổi ý được sau.
        </p>

        <TaoDuAnForm mau={MAU_DU_AN} />
      </section>
    </VoHocSinh>
  );
}
