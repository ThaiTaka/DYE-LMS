import { redirect } from 'next/navigation';

import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { LuoiBaiTap } from '@/components/hoc-sinh/the-bai-tap';
import { ChuNeon, TheKinh } from '@/components/ui/the-kinh';
import { requireSession } from '@/lib/guard';
import { duLieuDanhSachBaiTap, type TheBaiTap } from '@/lib/student-data';

/**
 * Every homework for the student's current classes, grouped by what it needs.
 *
 * Three groups rather than one sorted list, because the three want different
 * things from the child: to do, nothing (the teacher has it), and to read.
 * An empty group is left out rather than drawn as an empty box.
 */
export default async function TrangBaiTap() {
  const actor = await requireSession();
  if (actor.role !== 'STUDENT') redirect('/giao-vien/bai-tap');

  const ds = await duLieuDanhSachBaiTap(actor.id);
  const bayGio = new Date();

  const nhom: Array<{ id: string; tieuDe: string; moTa: string; bai: TheBaiTap[] }> = [
    {
      id: 'can-lam',
      tieuDe: 'Cần làm',
      moTa: 'Hạn gần nhất ở trên cùng. Quá hạn rồi em vẫn nộp được — thầy cô sẽ thấy là nộp muộn.',
      bai: ds.filter((b) => b.trangThai === 'chua-nop' || b.trangThai === 'qua-han'),
    },
    {
      id: 'cho-cham',
      tieuDe: 'Chờ thầy cô chấm',
      moTa: 'Em vẫn sửa và nộp lại được cho tới khi thầy cô chấm.',
      bai: ds.filter((b) => b.trangThai === 'da-nop'),
    },
    {
      id: 'da-cham',
      tieuDe: 'Đã có nhận xét',
      moTa: 'Mở bài để đọc thầy cô nhận xét gì nhé.',
      bai: ds.filter((b) => b.trangThai === 'da-cham'),
    },
  ];

  return (
    <>
      <DuongDan
        muc={[{ nhan: 'Trang chính', href: '/bang-dieu-khien' }, { nhan: 'Bài tập về nhà' }]}
      />

      <header className="mb-6">
        <h1 className="mt-0 mb-1 text-3xl font-extrabold sm:text-4xl">
          <ChuNeon>Bài tập về nhà</ChuNeon>
        </h1>
        <p className="m-0 text-chu-phu">Bài thầy cô giao cho lớp của em.</p>
      </header>

      {ds.length === 0 ? (
        <TheKinh className="p-6 text-chu-phu">
          <span aria-hidden="true">🎉 </span>
          Em chưa có bài tập về nhà nào. Khi thầy cô giao bài, bài sẽ hiện ở đây và trên trang
          chính.
        </TheKinh>
      ) : (
        <div className="grid gap-8">
          {nhom
            .filter((n) => n.bai.length > 0)
            .map((n) => (
              <section key={n.id} aria-labelledby={`nhom-${n.id}`}>
                <h2 id={`nhom-${n.id}`} className="mt-0 mb-1 text-xl font-bold">
                  {n.tieuDe}{' '}
                  <span className="text-base font-medium text-chu-nhat">({n.bai.length})</span>
                </h2>
                <p className="mt-0 mb-4 text-sm text-chu-phu">{n.moTa}</p>
                <LuoiBaiTap baiTap={n.bai} bayGio={bayGio} />
              </section>
            ))}
        </div>
      )}
    </>
  );
}
