import Link from 'next/link';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { KIEU_NHANH } from '@/components/ui/nhanh';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireRole } from '@/lib/guard';
import { duLieuBangGiaoVien, type GoiYNangNhanh, type HocSinhDangChuY } from '@/lib/teacher-data';

export default async function TrangGiaoVien() {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const data = await duLieuBangGiaoVien(actor);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <header className="mb-7">
        <h1 className="mt-0 mb-2 text-3xl font-bold sm:text-4xl">Chào {actor.displayName}</h1>
        <p className="m-0 text-chu-phu">
          {data.lop.length} lớp · {data.tongHocSinh} học sinh · tiến độ trung bình{' '}
          <strong className="text-chu">{data.tiLeTrungBinhChung}%</strong>
        </p>
      </header>

      {/* ── Classes ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="tieu-de-lop" className="mb-9">
        <h2 id="tieu-de-lop" className="mt-0 mb-4 text-xl font-bold">
          Lớp của thầy cô
        </h2>

        {data.lop.length === 0 ? (
          <p className="rounded-the border border-vien bg-the p-6 text-chu-phu">
            Chưa có lớp nào được giao. Liên hệ quản trị viên để được phân lớp.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
            {data.lop.map((l) => (
              <li key={l.classId}>
                <Link
                  href={`/giao-vien/lop/${l.classId}`}
                  className="block h-full rounded-the border border-vien bg-the p-5 transition-colors hover:border-chinh"
                >
                  <h3 className="mt-0 mb-1 text-lg leading-snug font-semibold text-chu">
                    {l.name}
                  </h3>
                  <p className="mt-0 mb-4 text-sm text-chu-nhat">
                    {l.code}
                    {l.term ? ` · ${l.term}` : ''} · {l.siSo} học sinh
                  </p>

                  <ThanhTienDo
                    nhan="Tiến độ trung bình của lớp"
                    phanTram={l.tiLeTrungBinh}
                    chuaGiao={l.siSo === 0}
                  />

                  <p className="mt-3 mb-0 flex flex-wrap gap-x-3 gap-y-1 text-sm text-chu-phu">
                    <span>
                      <strong className="text-dung">{l.soHoanThanh}</strong> em đã xong phần bắt buộc
                    </span>
                    {l.courses.map((c) => (
                      <span key={c.courseId} className="text-chu-nhat">
                        <span aria-hidden="true">{c.iconEmoji}</span> {c.title}
                      </span>
                    ))}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Two attention lists, side by side ───────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DanhSachChuY
          id="can-ho-tro"
          tieuDe="Nên hỏi thăm"
          icon="💬"
          moTa="Các em có thể đang cần thầy cô để ý thêm một chút."
          rong="Mọi em đều đang theo kịp. Không có ai cần hỏi thăm hôm nay."
          danhSach={data.canHoTro}
        />

        <DanhSachNangNhanh danhSach={data.diNhanh} />
      </div>
    </VoGiaoVien>
  );
}

/**
 * The attention list.
 *
 * Note the framing throughout: "Nên hỏi thăm" (worth checking in on) names an
 * action the teacher can take. The brief forbids labelling a child, so nothing
 * here describes the student — only their work, their last activity, and what
 * the teacher might do next.
 *
 * The colour is amber, the same token the student UI uses for "try again". Red
 * stays reserved for genuine system errors; a child being behind is not one.
 */
function DanhSachChuY({
  id,
  tieuDe,
  icon,
  moTa,
  rong,
  danhSach,
}: {
  id: string;
  tieuDe: string;
  icon: string;
  moTa: string;
  rong: string;
  danhSach: HocSinhDangChuY[];
}) {
  return (
    <section aria-labelledby={id} className="rounded-the border border-vien bg-the p-5">
      <h2 id={id} className="mt-0 mb-1 flex items-center gap-2 text-lg font-bold">
        <span aria-hidden="true">{icon}</span>
        {tieuDe}
        <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-sm font-semibold text-chu-phu">
          {danhSach.length}
        </span>
      </h2>
      <p className="mt-0 mb-4 text-sm text-chu-phu">{moTa}</p>

      {danhSach.length === 0 ? (
        <p className="m-0 rounded-nut bg-dung-nen p-4 text-sm text-dung">✓ {rong}</p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {danhSach.map((h) => (
            <li key={`${h.studentId}-${h.courseId}`}>
              {/*
                Classes are written out in full rather than composed from a
                prop: Tailwind resolves class names by scanning source text, so
                a template-built `bg-${x}-nen` compiles to no CSS at all.
              */}
              <Link
                href={`/giao-vien/hoc-sinh/${h.studentId}?khoa=${h.courseId}`}
                className="block rounded-nut border-s-4 border-thu-lai bg-thu-lai-nen p-3.5 transition-colors hover:bg-the-mo"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold text-chu">{h.displayName}</span>
                  <span className="text-sm text-chu-phu tabular-nums">
                    {h.daXong}/{h.tongBatBuoc} buổi · {h.phanTram}%
                  </span>
                </span>
                <span className="mt-1 block text-sm text-chu-phu">{h.lyDo}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Students moving quickly, with the tier they could be offered next.
 *
 * Framed as an invitation to extend, not a reward for ranking. The teacher still
 * decides; this list only surfaces the evidence they would otherwise have to go
 * looking for.
 */
function DanhSachNangNhanh({ danhSach }: { danhSach: GoiYNangNhanh[] }) {
  return (
    <section aria-labelledby="di-nhanh" className="rounded-the border border-vien bg-the p-5">
      <h2 id="di-nhanh" className="mt-0 mb-1 flex items-center gap-2 text-lg font-bold">
        <span aria-hidden="true">🚀</span>
        Sẵn sàng đi xa hơn
        <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-sm font-semibold text-chu-phu">
          {danhSach.length}
        </span>
      </h2>
      <p className="mt-0 mb-4 text-sm text-chu-phu">
        Các em đã xong phần được giao và còn muốn làm thêm. Có thể mời sang nhánh cao hơn.
      </p>

      {danhSach.length === 0 ? (
        <p className="m-0 rounded-nut bg-the-mo p-4 text-sm text-chu-phu">
          Chưa có em nào vượt phần được giao. Cứ để các em đi theo nhịp của mình.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {danhSach.map((h) => {
            const hienTai = KIEU_NHANH[h.tier];
            const deXuat = h.nhanhDeXuat ? KIEU_NHANH[h.nhanhDeXuat] : null;
            return (
              <li key={`${h.studentId}-${h.courseId}`}>
                <Link
                  href={`/giao-vien/hoc-sinh/${h.studentId}?khoa=${h.courseId}`}
                  className="block rounded-nut border-s-4 border-nang-cao bg-nang-cao-nen p-3.5 transition-colors hover:bg-the-mo"
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold text-chu">{h.displayName}</span>
                    <span className="text-sm text-chu-phu tabular-nums">{h.phanTram}%</span>
                  </span>
                  <span className="mt-1 block text-sm text-chu-phu">{h.lyDo}</span>

                  {deXuat ? (
                    <span className="mt-2 flex items-center gap-1.5 text-sm">
                      <span className={hienTai.chu}>
                        <span aria-hidden="true">{hienTai.icon}</span> {hienTai.nhan}
                      </span>
                      <span aria-hidden="true" className="text-chu-nhat">
                        →
                      </span>
                      <span className={`font-semibold ${deXuat.chu}`}>
                        <span aria-hidden="true">{deXuat.icon}</span> {deXuat.nhan}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-2 block text-sm text-mo-rong">
                      Đã ở nhánh cao nhất — có thể giao dự án riêng.
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
