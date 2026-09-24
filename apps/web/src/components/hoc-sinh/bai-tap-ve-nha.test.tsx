/**
 * Homework on the student side: the card on the dashboard, and the editor a
 * card leads to.
 *
 * The card is the brief's "Title, Deadline, Status" — asserted as text a child
 * reads, with overdue work framed as still open. The editor must open on the
 * right code and hand in exactly what is in it.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KhuBaiTapVeNha } from './khu-bai-tap-ve-nha';
import { TheBaiTapVeNha } from './the-bai-tap';

import type { TheBaiTap } from '@/lib/student-data';

const nop = vi.hoisted(() => vi.fn());
vi.mock('@/app/(hoc-sinh)/bai-tap/actions', () => ({ nopBaiTap: nop }));

beforeEach(() => {
  nop.mockReset();
  window.localStorage.clear();
});

const BAY_GIO = new Date('2026-09-24T12:00:00.000Z');

function the(over: Partial<TheBaiTap> = {}): TheBaiTap {
  return {
    id: 'hw1',
    tieuDe: 'Vẽ tam giác bằng dấu sao',
    tenLop: 'Lập trình cơ bản',
    baiHoc: { slug: 'python-buoi-05', buoi: 5, tenBai: 'Vòng lặp for' },
    // 18:00 Saturday, Vietnamese time.
    hanNop: '2026-09-26T11:00:00.000Z',
    trangThai: 'chua-nop',
    nopLuc: null,
    nopMuon: false,
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════════

describe('Thẻ bài tập', () => {
  it('hiện tên, lớp, buổi, hạn nộp và trạng thái; cả thẻ dẫn tới trang làm bài', () => {
    render(<TheBaiTapVeNha bai={the()} bayGio={BAY_GIO} />);

    const lienKet = screen.getByRole('link');
    expect(lienKet).toHaveAttribute('href', '/bai-tap/hw1');
    expect(lienKet).toHaveTextContent('Vẽ tam giác bằng dấu sao');
    expect(lienKet).toHaveTextContent('Lập trình cơ bản · sau Buổi 5');
    expect(lienKet).toHaveTextContent('18:00 · Thứ Bảy, 26/09');
    expect(lienKet).toHaveTextContent('Còn 1 ngày');
    expect(lienKet).toHaveTextContent('Chưa nộp');
  });

  it('dưới một ngày thì báo sắp hết hạn', () => {
    render(<TheBaiTapVeNha bai={the({ hanNop: '2026-09-24T17:00:00.000Z' })} bayGio={BAY_GIO} />);
    expect(screen.getByText(/Sắp hết hạn/)).toBeInTheDocument();
    expect(screen.getByText(/Còn 5 giờ/)).toBeInTheDocument();
  });

  it('quá hạn nói rõ là vẫn nộp được, không phải cửa đã đóng', () => {
    const { container } = render(
      <TheBaiTapVeNha
        bai={the({ trangThai: 'qua-han', hanNop: '2026-09-22T11:00:00.000Z' })}
        bayGio={BAY_GIO}
      />,
    );
    expect(screen.getByText(/Quá hạn · vẫn nộp được/)).toBeInTheDocument();
    // Amber, never the red reserved for system errors.
    expect(container.innerHTML).not.toMatch(/text-loi|bg-loi/);
  });

  it('đã nộp thì hiện giờ nộp, và không đếm ngược hạn nữa', () => {
    render(
      <TheBaiTapVeNha
        bai={the({ trangThai: 'da-nop', nopLuc: '2026-09-24T08:30:00.000Z' })}
        bayGio={BAY_GIO}
      />,
    );
    expect(screen.getByText(/Đã nộp · chờ chấm/)).toBeInTheDocument();
    expect(screen.getByText(/Nộp lúc/)).toHaveTextContent('15:30');
    expect(screen.queryByText(/còn 1 ngày/i)).not.toBeInTheDocument();
  });

  it('đã chấm thì mời đọc nhận xét', () => {
    render(<TheBaiTapVeNha bai={the({ trangThai: 'da-cham' })} bayGio={BAY_GIO} />);
    expect(screen.getByText(/Đã có nhận xét/)).toBeInTheDocument();
    expect(screen.getByText(/Đọc nhận xét/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Khu làm bài tập về nhà', () => {
  const MAU = 'n = 5\n# Viết tiếp ở đây';

  function noiDungSoanThao(): string {
    return screen.getByTestId('soan-thao').textContent ?? '';
  }

  it('chưa nộp thì mở bằng mã mẫu của thầy cô', () => {
    render(
      <KhuBaiTapVeNha
        homeworkId="hw1"
        tieuDe="Tam giác"
        maMau={MAU}
        baiNop={null}
        hocSinhId="hs1"
      />,
    );
    expect(noiDungSoanThao()).toContain('# Viết tiếp ở đây');
    expect(screen.getByText('Chưa nộp')).toBeInTheDocument();
  });

  it('đã nộp thì mở bằng bài đã nộp, không phải mã mẫu', () => {
    render(
      <KhuBaiTapVeNha
        homeworkId="hw1"
        tieuDe="Tam giác"
        maMau={MAU}
        baiNop={{
          code: 'print("bài của em")',
          nopLuc: '2026-09-24T08:30:00.000Z',
          nopMuon: false,
          daCham: false,
        }}
        hocSinhId="hs1"
      />,
    );
    expect(noiDungSoanThao()).toContain('bài của em');
    expect(screen.getByRole('button', { name: /Nộp lại bài/ })).toBeInTheDocument();
  });

  it('bấm nộp gửi đúng bài tập và đúng code trong ô, rồi báo đã nộp', async () => {
    nop.mockResolvedValue({
      trangThai: 'da-nop',
      thongDiep: 'Đã nộp bài! Thầy cô sẽ xem và nhận xét cho em.',
      nopLuc: '2026-09-24T09:00:00.000Z',
      nopMuon: false,
    });
    const nguoiDung = userEvent.setup();
    render(
      <KhuBaiTapVeNha
        homeworkId="hw1"
        tieuDe="Tam giác"
        maMau={MAU}
        baiNop={null}
        hocSinhId="hs1"
      />,
    );

    await nguoiDung.click(screen.getByRole('button', { name: /Nộp bài/ }));

    expect(nop).toHaveBeenCalledWith('hw1', MAU);
    expect(await screen.findByRole('status')).toHaveTextContent(/Đã nộp bài/);
    expect(screen.getByText(/Đã nộp lúc/)).toHaveTextContent('16:00');
  });

  it('bị từ chối thì báo lý do, code vẫn còn nguyên', async () => {
    nop.mockResolvedValue({
      trangThai: 'rong',
      thongDiep: 'Em viết code rồi hãy nộp nhé.',
      nopLuc: null,
      nopMuon: false,
    });
    const nguoiDung = userEvent.setup();
    render(
      <KhuBaiTapVeNha
        homeworkId="hw1"
        tieuDe="Tam giác"
        maMau={MAU}
        baiNop={null}
        hocSinhId="hs1"
      />,
    );

    await nguoiDung.click(screen.getByRole('button', { name: /Nộp bài/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Em viết code rồi hãy nộp/);
    expect(noiDungSoanThao()).toContain('# Viết tiếp ở đây');
  });

  it('đã chấm thì không còn nút nộp, và nói vì sao', () => {
    render(
      <KhuBaiTapVeNha
        homeworkId="hw1"
        tieuDe="Tam giác"
        maMau={MAU}
        baiNop={{
          code: 'print(1)',
          nopLuc: '2026-09-24T08:30:00.000Z',
          nopMuon: true,
          daCham: true,
        }}
        hocSinhId="hs1"
      />,
    );
    expect(screen.queryByRole('button', { name: /Nộp/ })).not.toBeInTheDocument();
    expect(screen.getByText(/không sửa được nữa/)).toBeInTheDocument();
    expect(screen.getByText(/nộp sau hạn/)).toBeInTheDocument();
  });

  it('"Đặt lại về mẫu" hỏi lại trước khi thay code', async () => {
    const nguoiDung = userEvent.setup();
    render(
      <KhuBaiTapVeNha
        homeworkId="hw1"
        tieuDe="Tam giác"
        maMau={MAU}
        baiNop={{
          code: 'print("khác mẫu")',
          nopLuc: '2026-09-24T08:30:00.000Z',
          nopMuon: false,
          daCham: false,
        }}
        hocSinhId="hs1"
      />,
    );

    await nguoiDung.click(screen.getByRole('button', { name: /Đặt lại về mẫu/ }));
    expect(noiDungSoanThao()).toContain('khác mẫu');

    await nguoiDung.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(noiDungSoanThao()).toContain('# Viết tiếp ở đây');
  });
});
