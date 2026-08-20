import { HangHocSinh } from '@/components/giao-vien/hang-hoc-sinh';
import { TaoTaiKhoan } from '@/components/giao-vien/tao-tai-khoan';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { duLieuTaiKhoanHocSinh } from '@/lib/teacher-data';

export default async function TrangTaiKhoanHocSinh() {
  // Open to teachers as well as admins. What each of them SEES differs, and that
  // difference comes from `duLieuTaiKhoanHocSinh` rather than from this page: a
  // teacher gets only the children they teach and only their own classes.
  const actor = await requireRole('ADMIN', 'TEACHER');
  const data = await duLieuTaiKhoanHocSinh(actor);
  const laQuanTri = actor.role === 'ADMIN';

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={laQuanTri ? 'ADMIN' : 'TEACHER'}>
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Học sinh' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Tài khoản học sinh</h1>
        <p className="m-0 text-chu-phu">
          Tạo tài khoản cho các em và xếp vào lớp. Mật khẩu ban đầu do thầy cô đặt, và em sẽ tự
          đổi ngay ở lần đăng nhập đầu tiên.
          {laQuanTri ? null : ' Trang này chỉ hiện các lớp và các em thầy cô đang dạy.'}
        </p>
      </header>

      <TaoTaiKhoan
        vaiTroCoDinh="STUDENT"
        tieuDe="Thêm học sinh"
        nhanMo="Thêm học sinh"
        lop={data.lopDangMo}
        batBuocChonLop={data.batBuocChonLop}
      />

      <h2 className="mt-0 mb-4 text-xl font-bold">Danh sách học sinh ({data.hocSinh.length})</h2>

      {data.hocSinh.length === 0 ? (
        <p className="rounded-the border border-vien bg-the p-5 text-chu-phu">
          Chưa có tài khoản học sinh nào. Bấm “Thêm học sinh” ở trên để tạo em đầu tiên.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {data.hocSinh.map((hs) => (
            <HangHocSinh key={hs.id} hs={hs} laQuanTri={laQuanTri} />
          ))}
        </ul>
      )}
    </VoGiaoVien>
  );
}
