/**
 * Homework on the teacher side: the builder and the grading row.
 *
 * The builder's rule worth a test is the class → lesson dependency: it must
 * never offer a lesson from a course the chosen class does not study, because
 * the server refuses those. The grading row must carry the version the teacher
 * actually read (`banDaXem`), and must show ungraded code without a click.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HangChamBaiTap } from './cham-bai-tap';
import { TaoBaiTap } from './tao-bai-tap';

import type { LopChoBaiTap } from '@/lib/teacher-data';

const giao = vi.hoisted(() => vi.fn());
const cham = vi.hoisted(() => vi.fn());
vi.mock('@/app/giao-vien/actions', () => ({ giaoBaiTapVeNha: giao, chamBaiTap: cham }));

beforeEach(() => {
  giao.mockReset();
  cham.mockReset();
  giao.mockResolvedValue({ trangThai: 'thanh-cong', thongDiep: 'Đã giao.' });
  cham.mockResolvedValue({ trangThai: 'thanh-cong', thongDiep: 'Đã chấm.' });
});

const LOP: LopChoBaiTap[] = [
  {
    id: 'lop-a',
    ten: 'Lập trình cơ bản',
    ma: 'LTCB',
    soHocSinh: 24,
    khoaHoc: [
      {
        id: 'py',
        ten: 'Python Cơ Bản',
        baiHoc: [
          { id: 'py-1', nhan: 'Buổi 1 · Làm quen Python' },
          { id: 'py-2', nhan: 'Buổi 2 · Biến' },
        ],
      },
    ],
  },
  {
    id: 'lop-b',
    ten: 'Micro:bit sáng thứ Bảy',
    ma: 'MB',
    soHocSinh: 12,
    khoaHoc: [{ id: 'mb', ten: 'Micro:bit', baiHoc: [{ id: 'mb-1', nhan: 'Buổi 1 · Hiện tên' }] }],
  },
];

function veTaoBaiTap() {
  return render(
    <TaoBaiTap lop={LOP} hanMacDinh="2026-10-01T20:00" hanToiThieu="2026-09-24T19:00" moSan />,
  );
}

// ═══════════════════════════════════════════════════════════════════════════

describe('Biểu mẫu giao bài', () => {
  it('có đủ các ô: tên, lớp, buổi học, hạn nộp, đề bài và khung mã mẫu', () => {
    veTaoBaiTap();

    expect(screen.getByRole('textbox', { name: 'Tên bài tập' })).toBeRequired();
    expect(screen.getByRole('combobox', { name: 'Lớp nhận bài' })).toBeRequired();
    expect(screen.getByRole('combobox', { name: /Sau buổi học/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Hạn nộp')).toHaveValue('2026-10-01T20:00');
    expect(screen.getByLabelText('Hạn nộp')).toHaveAttribute('min', '2026-09-24T19:00');
    expect(screen.getByRole('textbox', { name: 'Đề bài' })).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'Mã mẫu của bài tập' })).toBeInTheDocument();
  });

  it('chưa chọn lớp thì chưa chọn được buổi học', () => {
    veTaoBaiTap();
    expect(screen.getByRole('combobox', { name: /Sau buổi học/ })).toBeDisabled();
  });

  it('chỉ hiện buổi học thuộc khoá của lớp đã chọn', async () => {
    const nguoiDung = userEvent.setup();
    veTaoBaiTap();

    await nguoiDung.selectOptions(screen.getByRole('combobox', { name: 'Lớp nhận bài' }), 'lop-a');
    const buoi = screen.getByRole('combobox', { name: /Sau buổi học/ });

    expect(within(buoi).getByRole('option', { name: 'Buổi 2 · Biến' })).toBeInTheDocument();
    expect(
      within(buoi).queryByRole('option', { name: 'Buổi 1 · Hiện tên' }),
    ).not.toBeInTheDocument();
  });

  it('đổi lớp thì bỏ chọn buổi học của lớp cũ', async () => {
    const nguoiDung = userEvent.setup();
    veTaoBaiTap();
    const lop = screen.getByRole('combobox', { name: 'Lớp nhận bài' });
    const buoi = screen.getByRole('combobox', { name: /Sau buổi học/ });

    await nguoiDung.selectOptions(lop, 'lop-a');
    await nguoiDung.selectOptions(buoi, 'py-2');
    await nguoiDung.selectOptions(lop, 'lop-b');

    expect(buoi).toHaveValue('');
  });

  it('gửi đủ mọi trường, kể cả mã mẫu từ khung soạn thảo', async () => {
    const nguoiDung = userEvent.setup();
    veTaoBaiTap();

    await nguoiDung.type(screen.getByRole('textbox', { name: 'Tên bài tập' }), 'Tam giác sao');
    await nguoiDung.selectOptions(screen.getByRole('combobox', { name: 'Lớp nhận bài' }), 'lop-a');
    await nguoiDung.selectOptions(screen.getByRole('combobox', { name: /Sau buổi học/ }), 'py-2');
    await nguoiDung.type(screen.getByRole('textbox', { name: 'Đề bài' }), 'In ra tam giác 5 dòng.');
    await nguoiDung.click(screen.getByRole('button', { name: 'Giao bài' }));

    expect(giao).toHaveBeenCalledTimes(1);
    const form = giao.mock.calls[0]?.[1] as FormData;
    expect(Object.fromEntries(form)).toEqual({
      tieuDe: 'Tam giác sao',
      classId: 'lop-a',
      lessonId: 'py-2',
      hanNop: '2026-10-01T20:00',
      moTa: 'In ra tam giác 5 dòng.',
      maMau: '',
    });
    expect(await screen.findByText('Đã giao.')).toBeInTheDocument();
  });

  it('bị từ chối thì giữ nguyên mọi thứ thầy cô đã nhập', async () => {
    giao.mockResolvedValue({
      trangThai: 'loi',
      thongDiep: 'Hạn nộp phải ở sau thời điểm hiện tại.',
    });
    const nguoiDung = userEvent.setup();
    veTaoBaiTap();

    await nguoiDung.type(screen.getByRole('textbox', { name: 'Tên bài tập' }), 'Tam giác sao');
    await nguoiDung.selectOptions(screen.getByRole('combobox', { name: 'Lớp nhận bài' }), 'lop-a');
    await nguoiDung.type(screen.getByRole('textbox', { name: 'Đề bài' }), 'Đề dài công phu.');
    await nguoiDung.click(screen.getByRole('button', { name: 'Giao bài' }));

    expect(await screen.findByText(/Hạn nộp phải ở sau/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Tên bài tập' })).toHaveValue('Tam giác sao');
    expect(screen.getByRole('textbox', { name: 'Đề bài' })).toHaveValue('Đề dài công phu.');
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Chấm bài tập', () => {
  const NOP = '2026-09-24T08:30:00.123Z';

  it('em chưa nộp: một dòng, không có ô chấm', () => {
    render(<HangChamBaiTap hang={{ studentId: 's1', tenHocSinh: 'An', baiNop: null }} />);
    expect(screen.getByText('Chưa nộp')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('bài chờ chấm: code hiện sẵn, và form mang đúng phiên bản thầy cô đang đọc', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = render(
      <HangChamBaiTap
        hang={{
          studentId: 's1',
          tenHocSinh: 'An',
          baiNop: {
            id: 'sub1',
            code: 'print("*")',
            nopLuc: NOP,
            nopMuon: true,
            daCham: false,
            nhanXet: null,
            chamLuc: null,
          },
        }}
      />,
    );

    expect(screen.getByLabelText('Bài của An')).toHaveTextContent('print("*")');
    expect(screen.getByText('Nộp sau hạn')).toBeInTheDocument();

    await nguoiDung.type(screen.getByRole('textbox', { name: 'Nhận xét cho An' }), 'Tốt lắm!');
    await nguoiDung.click(screen.getByRole('button', { name: /Lưu nhận xét/ }));

    const form = cham.mock.calls[0]?.[1] as FormData;
    expect(form.get('submissionId')).toBe('sub1');
    // Millisecond-exact: the server compares it to `submittedAt`.
    expect(form.get('banDaXem')).toBe(NOP);
    expect(form.get('nhanXet')).toBe('Tốt lắm!');
    expect(container.querySelector('input[name="banDaXem"]')).not.toBeNull();
  });

  it('bài đã chấm: hiện nhận xét, code gập lại, sửa được nhận xét', async () => {
    const nguoiDung = userEvent.setup();
    render(
      <HangChamBaiTap
        hang={{
          studentId: 's1',
          tenHocSinh: 'An',
          baiNop: {
            id: 'sub1',
            code: 'print("*")',
            nopLuc: NOP,
            nopMuon: false,
            daCham: true,
            nhanXet: 'Em làm tốt.',
            chamLuc: '2026-09-24T10:00:00.000Z',
          },
        }}
      />,
    );

    expect(screen.getByText('Em làm tốt.')).toBeInTheDocument();
    expect(screen.queryByText('print("*")')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: 'Sửa nhận xét' }));
    expect(screen.getByRole('textbox', { name: 'Nhận xét cho An' })).toHaveValue('Em làm tốt.');
    expect(screen.getByRole('button', { name: 'Cập nhật nhận xét' })).toBeInTheDocument();
  });
});
