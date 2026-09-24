/**
 * The post-lesson reflection box.
 *
 * The brief's hard rule is the first describe: the button stays disabled until
 * the text reaches 150 words, and the counter says how far there is to go
 * ("120/150 chữ"). The server enforces the same floor with the same function
 * (`demSoChu`, tested in @dye/core) — these tests hold the browser side to it.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KhoiTuLuanHocTap } from './khoi-tu-luan-hoc-tap';

const nop = vi.hoisted(() => vi.fn());
vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/actions', () => ({
  nopBaiTuLuanHocTap: nop,
}));

beforeEach(() => {
  nop.mockReset();
  window.localStorage.clear();
});

/** `n` space-separated words. */
function chu(n: number): string {
  return Array.from({ length: n }, (_, i) => `chữ${i}`).join(' ');
}

function oViet(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: 'Bài tự luận của em' }) as HTMLTextAreaElement;
}

function nutGui(): HTMLButtonElement {
  return screen.getByRole('button', { name: /Gửi bài tự luận/ }) as HTMLButtonElement;
}

async function viet(vanBan: string) {
  const nguoiDung = userEvent.setup();
  await nguoiDung.click(oViet());
  await nguoiDung.paste(vanBan);
  return nguoiDung;
}

describe('Mức tối thiểu 150 chữ', () => {
  it('ô trống: nút gửi bị khoá, bộ đếm hiện 0/150 chữ', () => {
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);

    expect(nutGui()).toBeDisabled();
    expect(screen.getByText('0/150 chữ')).toBeInTheDocument();
    expect(screen.getByText(/Cần thêm 150 chữ nữa/)).toBeInTheDocument();
  });

  it('120 chữ: vẫn khoá, và nói rõ còn thiếu 30 chữ', async () => {
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    await viet(chu(120));

    expect(screen.getByText('120/150 chữ')).toBeInTheDocument();
    expect(screen.getByText(/Cần thêm 30 chữ nữa/)).toBeInTheDocument();
    expect(nutGui()).toBeDisabled();
  });

  it('149 chữ vẫn khoá — đúng từng chữ một', async () => {
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    await viet(chu(149));

    expect(screen.getByText('149/150 chữ')).toBeInTheDocument();
    expect(nutGui()).toBeDisabled();
  });

  it('đủ 150 chữ thì mở nút, và báo cho trình đọc màn hình', async () => {
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    await viet(chu(150));

    expect(screen.getByText('150/150 chữ')).toBeInTheDocument();
    expect(nutGui()).toBeEnabled();
    expect(screen.getByText(/Đã đủ 150 chữ/)).toBeInTheDocument();
  });

  it('dấu câu đứng riêng không được tính để lách mức tối thiểu', async () => {
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    await viet(`${chu(100)} ${Array.from({ length: 60 }, () => '-').join(' ')}`);

    expect(screen.getByText('100/150 chữ')).toBeInTheDocument();
    expect(nutGui()).toBeDisabled();
  });

  it('xoá bớt xuống dưới 150 chữ thì nút khoá lại', async () => {
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    const nguoiDung = await viet(chu(150));
    expect(nutGui()).toBeEnabled();

    await nguoiDung.type(
      oViet(),
      '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}',
    );
    expect(screen.getByText('149/150 chữ')).toBeInTheDocument();
    expect(nutGui()).toBeDisabled();
  });
});

describe('Gửi bài', () => {
  it('gửi đúng bài học và nội dung; nhận xong thì hiện bài đã gửi, không còn ô viết', async () => {
    nop.mockResolvedValue({ trangThai: 'da-nhan', thongDiep: 'Đã gửi' });
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    const nguoiDung = await viet(chu(155));

    await nguoiDung.click(nutGui());

    expect(nop).toHaveBeenCalledWith('l1', chu(155));
    expect(await screen.findByText(/Đã gửi · 155 chữ/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('máy chủ từ chối thì nói lý do và giữ nguyên bài trong ô', async () => {
    nop.mockResolvedValue({
      trangThai: 'tu-choi',
      thongDiep: 'Bài này đang bị khoá vì hệ thống ghi nhận em rời khỏi tab quá nhiều lần.',
    });
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    const nguoiDung = await viet(chu(150));

    await nguoiDung.click(nutGui());

    expect(await screen.findByRole('alert')).toHaveTextContent(/đang bị khoá/);
    expect(oViet().value).toBe(chu(150));
  });

  it('mạng lỗi thì không nuốt bài của em', async () => {
    nop.mockRejectedValue(new Error('fetch failed'));
    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    const nguoiDung = await viet(chu(150));

    await nguoiDung.click(nutGui());

    expect(await screen.findByRole('alert')).toHaveTextContent(/bài vẫn còn trong ô/);
    expect(oViet().value).toBe(chu(150));
  });
});

describe('Trạng thái khác', () => {
  it('đã gửi từ trước (máy chủ trả về) thì chỉ hiện bài, không có ô viết', () => {
    render(
      <KhoiTuLuanHocTap
        lessonId="l1"
        hocSinhId="hs1"
        daNop={{
          noiDung: 'Hôm nay em học vòng lặp.',
          soChu: 162,
          nopLuc: '2026-09-24T08:30:00.000Z',
        }}
      />,
    );

    expect(screen.getByText(/Đã gửi · 162 chữ/)).toBeInTheDocument();
    expect(screen.getByText('Hôm nay em học vòng lặp.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // Vietnamese wall clock, whatever zone the test machine is in.
    expect(screen.getByText(/15:30/)).toBeInTheDocument();
  });

  it('giáo viên xem trước: đủ chữ vẫn không gửi được, và được nói vì sao', async () => {
    render(<KhoiTuLuanHocTap lessonId="l1" daNop={null} xemTruoc />);
    await viet(chu(150));

    expect(nutGui()).toBeDisabled();
    expect(screen.getByText(/chỉ học sinh mới gửi được/)).toBeInTheDocument();
  });

  it('bài viết dở được giữ trong trình duyệt và mở lại ở lần sau', async () => {
    const { unmount } = render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    await viet(chu(40));
    // Unmount flushes the throttled write, as leaving the page does.
    unmount();

    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    expect(await screen.findByText(/Đã mở lại phần em đang viết dở/)).toBeInTheDocument();
    expect(oViet().value).toBe(chu(40));
  });

  it('bản lưu tạm của em khác không bao giờ hiện ra', async () => {
    const { unmount } = render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    await viet(chu(40));
    unmount();

    render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs2" daNop={null} />);
    expect(oViet().value).toBe('');
  });

  it('không có lỗi trợ năng', async () => {
    const { container } = render(<KhoiTuLuanHocTap lessonId="l1" hocSinhId="hs1" daNop={null} />);
    const ketQua = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(ketQua.violations).toEqual([]);

    // The counter describes the textarea, so it is read out on focus.
    const moTa = oViet().getAttribute('aria-describedby') ?? '';
    const dem = document.getElementById(moTa.split(' ')[0] ?? '');
    expect(dem && within(dem).getByText('0/150 chữ')).toBeTruthy();
  });
});
