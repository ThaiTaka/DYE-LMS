import { ChamTuLuan } from '@/components/giao-vien/cham-tu-luan';
import { TuLuanDaChamHang } from '@/components/giao-vien/tu-luan-da-cham';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { duLieuTuLuanChoCham, duLieuTuLuanDaCham } from '@/lib/teacher-data';

function gioPhut(d: Date): string {
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Essays: the queue, then the record.
 *
 * ── Why this is its own page ─────────────────────────────────────────────────
 * The grading form used to live only at the top of "Kết quả", and only while
 * something was waiting. With an empty queue it rendered nothing, so a teacher
 * who had not yet received an essay — or had marked them all — found no trace
 * of the feature and concluded it did not exist. There was also nowhere to see
 * what had ALREADY been marked, which is the half a teacher actually needs when
 * a student asks about their score.
 *
 * Both halves live here, the page has a nav entry with a count, and the count
 * is what tells a teacher there is work before they go looking.
 */
export default async function TrangTuLuan() {
  const actor = await requireRole('TEACHER', 'ADMIN');

  const [choCham, daCham] = await Promise.all([
    duLieuTuLuanChoCham(actor),
    duLieuTuLuanDaCham(actor),
  ]);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Bài tự luận' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Bài tự luận</h1>
        <p className="m-0 text-chu-phu">
          Máy không chấm được tự luận. Em nào nộp rồi thì câu đó khoá lại cho tới khi thầy cô chấm
          hoặc mở lại.{' '}
          {actor.role === 'ADMIN'
            ? 'Trang này hiện toàn hệ thống.'
            : 'Trang này chỉ hiện học sinh trong lớp thầy cô phụ trách.'}
        </p>
      </header>

      <section aria-labelledby="cho-cham" className="mb-10">
        <h2 id="cho-cham" className="mt-0 mb-4 text-xl font-bold">
          Chờ chấm ({choCham.length})
        </h2>
        {choCham.length === 0 ? (
          <p className="m-0 rounded-nut border border-vien bg-the-mo p-4 text-chu-phu">
            Không có bài nào đang chờ. Khi học sinh nộp tự luận, bài sẽ hiện ở đây và mục
            &ldquo;Tự luận&rdquo; trên thanh điều hướng sẽ báo số.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {choCham.map((t) => (
              <ChamTuLuan
                key={t.answerId}
                answerId={t.answerId}
                tenHocSinh={t.tenHocSinh}
                prompt={t.prompt}
                noiDung={t.noiDung}
                diemToiDa={t.diemToiDa}
                lessonTitle={t.lessonTitle}
                lessonOrder={t.lessonOrder}
                nopLuc={gioPhut(t.nopLuc)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="da-cham">
        <h2 id="da-cham" className="mt-0 mb-1 text-xl font-bold">
          Đã chấm ({daCham.length})
        </h2>
        <p className="mt-0 mb-4 text-sm text-chu-phu">
          Mới chấm lên trước. Muốn đổi điểm, mở lại bài để em làm lại — điểm không sửa tay được.
        </p>
        {daCham.length === 0 ? (
          <p className="m-0 rounded-nut border border-vien bg-the-mo p-4 text-chu-phu">
            Chưa có bài nào được chấm.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {daCham.map((t) => (
              <TuLuanDaChamHang
                key={t.answerId}
                answerId={t.answerId}
                tenHocSinh={t.tenHocSinh}
                prompt={t.prompt}
                noiDung={t.noiDung}
                diem={t.diem}
                diemToiDa={t.diemToiDa}
                dat={t.dat}
                khoaViPham={t.khoaViPham}
                lessonTitle={t.lessonTitle}
                lessonOrder={t.lessonOrder}
                chamLuc={gioPhut(t.chamLuc)}
              />
            ))}
          </ul>
        )}
      </section>
    </VoGiaoVien>
  );
}
