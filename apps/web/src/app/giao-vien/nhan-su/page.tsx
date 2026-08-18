import { HangNhanSu } from '@/components/giao-vien/quan-ly-nhan-su';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { duLieuNhanVien } from '@/lib/teacher-data';

export default async function TrangNhanSu() {
  // Admin-only. A teacher reaching this URL lands on the no-permission page
  // rather than an empty list, so the boundary is stated rather than implied.
  const actor = await requireRole('ADMIN');
  const data = await duLieuNhanVien(actor);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro="ADMIN">
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Nhân sự' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Nhân sự</h1>
        <p className="m-0 text-chu-phu">
          Quản lý tài khoản giáo viên và quản trị viên, kèm luồng bàn giao an toàn khi có người
          rời trường.
        </p>
      </header>

      <section
        aria-labelledby="vi-sao-ban-giao"
        className="mb-7 rounded-the border border-vien bg-the p-5"
      >
        <h2 id="vi-sao-ban-giao" className="mt-0 mb-2 text-lg font-bold">
          Vì sao xoá tài khoản giáo viên lại cần bàn giao?
        </h2>
        <p className="mt-0 mb-3 text-chu-phu">
          Cơ sở dữ liệu cố ý ràng buộc năm loại bản ghi vào người tạo ra chúng: lớp phụ trách, phân
          nhánh học của từng em, can thiệp mở/khoá bài học, thông báo lớp, và nhận xét bài làm.
        </p>
        <p className="m-0 text-chu-phu">
          Mỗi bản ghi đó ghi lại một quyết định mà một người lớn có tên tuổi đã đưa ra về một đứa
          trẻ cụ thể. Câu hỏi{' '}
          <em>&ldquo;ai đã quyết định việc này, và khi nào?&rdquo;</em> phải trả lời được kể cả
          sau khi người đó rời trường — nên hệ thống yêu cầu chỉ định người kế nhiệm thay vì lặng
          lẽ xoá theo.
        </p>
      </section>

      <h2 className="mt-0 mb-4 text-xl font-bold">
        Danh sách tài khoản ({data.nhanVien.length})
      </h2>

      <ul className="m-0 list-none space-y-4 p-0">
        {data.nhanVien.map((nv) => (
          <HangNhanSu key={nv.id} nv={nv} nguoiNhan={data.nguoiNhanBanGiao} />
        ))}
      </ul>
    </VoGiaoVien>
  );
}
