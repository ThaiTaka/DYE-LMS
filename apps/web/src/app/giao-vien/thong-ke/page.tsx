import Link from 'next/link';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireRole } from '@/lib/guard';
import { duLieuThongKe } from '@/lib/teacher-data';

import type { ThongKeHocSinh, ThongKeLop } from '@dye/core';

/**
 * Teaching analytics.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * A TEACHER sees only classes they run; an ADMIN sees every class. The rule is
 * enforced once, in `thongKeGiangDay` in @dye/core, and this page renders
 * whatever comes back. An aggregate is a leak with extra steps — `AVG(score)`
 * over "all classes" is one harmless-looking query that hands a teacher a number
 * derived from children they have no relationship with — so the filter is not
 * re-expressed here where it could drift.
 *
 * ── What is on the page, and what is deliberately absent ─────────────────────
 * Completion and mean score, both describing WORK. There is no ranking, no
 * percentile, no leaderboard and no per-child label. The student table is
 * sorted BY NAME rather than by score, because its purpose is "who do I sit
 * with next lesson?" and a table sorted by score answers a different, worse
 * question.
 *
 * The tab-out column sits next to the work columns rather than in a section of
 * its own, and its header says what it counts. On its own it means very little;
 * beside a stalled completion bar it is the start of a conversation.
 */
export default async function TrangThongKe({
  searchParams,
}: {
  searchParams: Promise<{ luu_tru?: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { luu_tru } = await searchParams;
  const keCaLuuTru = luu_tru === 'co';

  const data = await duLieuThongKe(actor, { keCaLuuTru });

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Thống kê' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Thống kê</h1>
        <p className="m-0 text-chu-phu">
          {data.toanHeThong
            ? 'Toàn hệ thống — mọi lớp trong trường.'
            : 'Các lớp thầy cô đang phụ trách.'}{' '}
          Số liệu mô tả <strong className="text-chu">bài làm</strong>, không mô tả học sinh.
        </p>
      </header>

      {/* ── Headline numbers ───────────────────────────────────────────── */}
      <section aria-labelledby="tong-quan" className="mb-8">
        <h2 id="tong-quan" className="sr-only">
          Tổng quan
        </h2>
        <dl className="m-0 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <O nhan="Lớp" giaTri={String(data.soLop)} phu={keCaLuuTru ? 'kể cả đã lưu trữ' : 'đang mở'} />
          <O nhan="Học sinh" giaTri={String(data.soHocSinh)} phu="đang theo học" />
          <O
            nhan="Hoàn thành phần bắt buộc"
            giaTri={`${data.tiLeHoanThanh}%`}
            phu="trung bình các lớp"
          />
          <O
            nhan="Bài nộp đạt"
            giaTri={data.tiLeDat === null ? '—' : `${data.tiLeDat}%`}
            phu={`trên ${data.soBaiNop} bài đã chấm`}
          />
        </dl>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">Từng lớp</h2>
        <Link
          href={keCaLuuTru ? '/giao-vien/thong-ke' : '/giao-vien/thong-ke?luu_tru=co'}
          className="flex min-h-cham items-center rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
        >
          {keCaLuuTru ? 'Ẩn lớp đã lưu trữ' : 'Hiện cả lớp đã lưu trữ'}
        </Link>
      </div>

      {data.lop.length === 0 ? (
        <p className="rounded-the border border-vien bg-the p-6 text-chu-phu">
          {data.toanHeThong
            ? 'Chưa có lớp nào trong hệ thống. Tạo lớp đầu tiên ở trang Lớp học.'
            : 'Chưa có lớp nào được giao cho thầy cô. Liên hệ quản trị viên để được phân lớp.'}
        </p>
      ) : (
        <div className="space-y-6">
          {data.lop.map((l) => (
            <BangLop key={l.classId} lop={l} />
          ))}
        </div>
      )}
    </VoGiaoVien>
  );
}

function O({ nhan, giaTri, phu }: { nhan: string; giaTri: string; phu: string }) {
  return (
    <div className="rounded-the border border-vien bg-the p-5">
      <dt className="m-0 text-sm font-medium text-chu-phu">{nhan}</dt>
      <dd className="mt-1 mb-0 text-3xl font-bold tabular-nums">{giaTri}</dd>
      <dd className="mt-1 mb-0 text-sm text-chu-nhat">{phu}</dd>
    </div>
  );
}

function BangLop({ lop }: { lop: ThongKeLop }) {
  return (
    <section
      aria-labelledby={`lop-${lop.classId}`}
      className="rounded-the border border-vien bg-the"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-vien p-5">
        <div className="min-w-0">
          <h3
            id={`lop-${lop.classId}`}
            className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-lg font-bold"
          >
            <Link href={`/giao-vien/lop/${lop.classId}`} className="hover:underline">
              {lop.ten}
            </Link>
            {lop.daLuuTru ? (
              <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
                Đã lưu trữ
              </span>
            ) : null}
            {lop.soCanhBaoMo > 0 ? (
              <Link
                href="/giao-vien/canh-bao"
                className="rounded-full bg-thu-lai-nen px-2.5 py-0.5 text-xs font-semibold text-thu-lai hover:underline"
              >
                {lop.soCanhBaoMo} cảnh báo chờ xử lý
              </Link>
            ) : null}
          </h3>
          <p className="m-0 text-sm text-chu-phu">
            {lop.ma} · {lop.giaoVien} · {lop.siSo} học sinh
            {lop.term ? ` · ${lop.term}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <p className="m-0">
            <span className="block text-chu-nhat">Hoàn thành</span>
            <strong className="text-lg tabular-nums">{lop.tiLeHoanThanh}%</strong>
          </p>
          <p className="m-0">
            <span className="block text-chu-nhat">Điểm trung bình</span>
            <strong className="text-lg tabular-nums">{lop.diemTrungBinh ?? '—'}</strong>
          </p>
          <p className="m-0">
            <span className="block text-chu-nhat">Bài nộp đạt</span>
            <strong className="text-lg tabular-nums">
              {lop.tiLeDat === null ? '—' : `${lop.tiLeDat}%`}
            </strong>
          </p>
        </div>
      </header>

      {lop.khoaHoc.length === 0 ? (
        <p className="m-0 p-5 text-chu-phu">
          Lớp này chưa được gắn khoá học nào, nên chưa có gì để thống kê.{' '}
          <Link href={`/giao-vien/lop/${lop.classId}`} className="underline">
            Gắn khoá học
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="grid gap-4 border-b border-vien p-5 sm:grid-cols-2">
            {lop.khoaHoc.map((k) => (
              <div key={k.courseId}>
                <p className="mt-0 mb-2 text-sm font-semibold">
                  <span aria-hidden="true">{k.iconEmoji}</span> {k.title}
                </p>
                <ThanhTienDo
                  nhan={`Tiến độ trung bình khoá ${k.title}`}
                  phanTram={k.tiLeHoanThanh}
                  chuaGiao={lop.siSo === 0 || lop.siSo === k.soChuaGiao}
                />
                <p className="mt-2 mb-0 text-sm text-chu-phu">
                  <strong className="text-dung">{k.soHoanThanh}</strong> em đã xong phần bắt buộc
                  {k.soChuaGiao > 0 ? ` · ${k.soChuaGiao} em chưa được giao gì` : ''}
                </p>
              </div>
            ))}
          </div>

          {lop.hocSinh.length === 0 ? (
            <p className="m-0 p-5 text-chu-phu">Lớp này chưa có học sinh nào đang theo học.</p>
          ) : (
            <BangHocSinh hocSinh={lop.hocSinh} tenLop={lop.ten} />
          )}
        </>
      )}
    </section>
  );
}

function BangHocSinh({ hocSinh, tenLop }: { hocSinh: ThongKeHocSinh[]; tenLop: string }) {
  const dinhDangNgay = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' });

  return (
    // Scrolls inside its own box rather than pushing the page sideways —
    // teachers do open this on a tablet in class.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-base">
        <caption className="sr-only">
          Kết quả từng học sinh lớp {tenLop}, sắp xếp theo tên
        </caption>
        <thead>
          <tr className="border-b border-vien bg-the-mo">
            <th scope="col" className="px-4 py-3 text-start text-sm font-semibold">
              Học sinh
            </th>
            <th scope="col" className="px-4 py-3 text-start text-sm font-semibold">
              Phần bắt buộc
            </th>
            <th scope="col" className="px-4 py-3 text-end text-sm font-semibold">
              Điểm TB
            </th>
            <th scope="col" className="px-4 py-3 text-end text-sm font-semibold">
              Bài nộp
            </th>
            <th scope="col" className="px-4 py-3 text-end text-sm font-semibold">
              Rời tab
            </th>
            <th scope="col" className="px-4 py-3 text-end text-sm font-semibold">
              Hoạt động cuối
            </th>
          </tr>
        </thead>
        <tbody>
          {hocSinh.map((h) => (
            <tr key={h.studentId} className="border-b border-vien last:border-b-0">
              <th scope="row" className="px-4 py-3 text-start font-medium">
                <Link href={`/giao-vien/hoc-sinh/${h.studentId}`} className="hover:underline">
                  {h.displayName}
                </Link>
                <span className="block text-sm font-normal text-chu-nhat">{h.username}</span>
              </th>

              <td className="w-56 px-4 py-3">
                <ThanhTienDo
                  nhan={`Tiến độ của ${h.displayName}`}
                  phanTram={h.tiLeHoanThanh}
                  chuaGiao={h.tiLeHoanThanh === 0 && h.soBaiNop === 0}
                />
              </td>

              <td className="px-4 py-3 text-end tabular-nums">{h.diemTrungBinh ?? '—'}</td>

              <td className="px-4 py-3 text-end text-sm tabular-nums">
                {h.soBaiNop === 0 ? '—' : `${h.soBaiDat}/${h.soBaiNop}`}
              </td>

              {/*
                Amber only, and only past the threshold. A red cell would render
                a verdict the data cannot support — the system does not know
                where the student went, and this column exists to prompt a
                question, not to answer one.
              */}
              <td
                className={`px-4 py-3 text-end text-sm tabular-nums ${
                  h.soLanRoiTab >= 3 ? 'font-semibold text-thu-lai' : 'text-chu-nhat'
                }`}
              >
                {h.soLanRoiTab === 0 ? '—' : h.soLanRoiTab}
              </td>

              <td className="px-4 py-3 text-end text-sm text-chu-phu">
                {h.hoatDongCuoi ? dinhDangNgay.format(h.hoatDongCuoi) : 'chưa có'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
