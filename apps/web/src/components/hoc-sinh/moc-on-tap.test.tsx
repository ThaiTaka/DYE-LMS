/**
 * The two review milestones, as a child meets them.
 *
 * Boss fight: HP moves by the SERVER's verdict — a right answer takes a hit off
 * the boss, a wrong one a heart off the student — and a finished fight, won or
 * lost, completes the block once. Nothing in the component knows an answer
 * before it asks.
 *
 * Presentation: "Nộp" lights up on exactly the deck `kiemTraThuyetTrinh`
 * accepts (the function the server runs too), says which slide is missing
 * what until then, and a draft survives a reload.
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KhoiDanhBoss } from './khoi-danh-boss';
import { KhoiThuyetTrinh } from './khoi-thuyet-trinh';

import type { CauHoiOnTap } from '@dye/core';

const danhBoss = vi.hoisted(() => vi.fn());
const danhDauXong = vi.hoisted(() => vi.fn());
const nopThuyetTrinh = vi.hoisted(() => vi.fn());

vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/actions', () => ({
  danhBoss,
  danhDauKhoiXong: danhDauXong,
  nopBaiThuyetTrinh: nopThuyetTrinh,
}));

beforeEach(() => {
  danhBoss.mockReset();
  danhDauXong.mockReset().mockResolvedValue({ baiXong: false, daGhi: true });
  nopThuyetTrinh.mockReset();
  window.localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════
// Boss fight
// ═══════════════════════════════════════════════════════════════════════════

function cau(n: number): CauHoiOnTap[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    type: 'MULTIPLE_CHOICE' as const,
    prompt: `Câu hỏi số ${i}`,
    template: null,
    mediaUrl: null,
    choices: [
      { id: `q${i}-a`, text: `A${i}` },
      { id: `q${i}-b`, text: `B${i}` },
    ],
    buoi: 3,
  }));
}

function mau(ten: string): number {
  return Number(screen.getByRole('progressbar', { name: ten }).getAttribute('aria-valuenow'));
}

function veBoss(n = 5) {
  return render(
    <KhoiDanhBoss
      blockId="boss1"
      tenBoss="Rồng Vòng Lặp"
      bieuTuong="🐉"
      tuBuoi={1}
      denBuoi={5}
      cauHoi={cau(n)}
      daXong={false}
    />,
  );
}

/** Answer the question on screen; the server stub decides right or wrong. */
async function tungDon(nguoiDung: ReturnType<typeof userEvent.setup>, dung: boolean) {
  danhBoss.mockResolvedValueOnce({
    trangThai: 'da-cham',
    dung,
    dapAnDung: dung ? null : 'Đáp án thật',
    giaiThich: 'Vì thế này.',
  });
  const nut = screen.getAllByRole('button').find((b) => /^A\d+$/.test(b.textContent ?? ''));
  await nguoiDung.click(nut!);
}

describe('Trận boss', () => {
  it('trước trận: hiện máu boss và tim của em theo quy tắc chung (5 câu → 3 máu, 3 tim)', () => {
    veBoss(5);
    expect(mau('HP Boss')).toBe(3);
    expect(mau('Tim của em')).toBe(3);
    expect(screen.getByRole('button', { name: /Vào trận/ })).toBeInTheDocument();
  });

  it('đúng → boss mất máu; sai → em mất tim và thấy đáp án đúng', async () => {
    const nd = userEvent.setup();
    veBoss(5);
    await nd.click(screen.getByRole('button', { name: /Vào trận/ }));

    await tungDon(nd, true);
    expect(mau('HP Boss')).toBe(2);
    expect(mau('Tim của em')).toBe(3);
    expect(danhBoss).toHaveBeenCalledWith(
      'boss1',
      expect.stringMatching(/^q\d$/),
      expect.stringMatching(/-a$/),
    );

    await nd.click(screen.getByRole('button', { name: /Đòn tiếp theo/ }));
    await tungDon(nd, false);
    expect(mau('Tim của em')).toBe(2);
    expect(screen.getByText('Đáp án thật')).toBeInTheDocument();
  });

  it('câu vừa trả lời ĐỨNG YÊN cùng phản hồi của nó, tới khi em bấm "Đòn tiếp theo"', async () => {
    // Regression: the question was derived from the answer count, so it was
    // swapped for the next one under its own feedback the moment it was marked.
    const nd = userEvent.setup();
    veBoss(5);
    await nd.click(screen.getByRole('button', { name: /Vào trận/ }));

    const cauDau = screen.getByText(/^Câu hỏi số \d$/).textContent;
    await tungDon(nd, false);
    expect(screen.getByText(/^Câu hỏi số \d$/).textContent).toBe(cauDau);
    expect(screen.getByText(/Đòn 1/)).toBeInTheDocument();

    await nd.click(screen.getByRole('button', { name: /Đòn tiếp theo/ }));
    expect(screen.getByText(/^Câu hỏi số \d$/).textContent).not.toBe(cauDau);
    expect(screen.getByText(/Đòn 2/)).toBeInTheDocument();
  });

  it('hạ gục boss → thắng, ghi nhận khối đúng MỘT lần', async () => {
    const nd = userEvent.setup();
    veBoss(5);
    await nd.click(screen.getByRole('button', { name: /Vào trận/ }));

    for (let i = 0; i < 3; i += 1) {
      await tungDon(nd, true);
      if (i < 2) await nd.click(screen.getByRole('button', { name: /Đòn tiếp theo/ }));
    }

    expect(await screen.findByText(/Em đã hạ gục Rồng Vòng Lặp/)).toBeInTheDocument();
    expect(danhDauXong).toHaveBeenCalledTimes(1);
    expect(danhDauXong).toHaveBeenCalledWith('boss1');
  });

  it('hết tim → không có chữ "thua", có nút đấu lại, khối VẪN được ghi nhận', async () => {
    const nd = userEvent.setup();
    const { container } = veBoss(5);
    await nd.click(screen.getByRole('button', { name: /Vào trận/ }));

    for (let i = 0; i < 3; i += 1) {
      await tungDon(nd, false);
      if (i < 2) await nd.click(screen.getByRole('button', { name: /Đòn tiếp theo/ }));
    }

    expect(await screen.findByText(/vẫn còn đứng vững/)).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toMatch(/\bthua\b/);
    expect(danhDauXong).toHaveBeenCalledTimes(1);

    // The ⚔️ is aria-hidden, so the button's name is the words alone.
    await nd.click(screen.getByRole('button', { name: /^Đấu lại$/ }));
    expect(mau('HP Boss')).toBe(3);
    expect(mau('Tim của em')).toBe(3);
  });

  it('máy chủ từ chối → không đổi máu, hiện lý do', async () => {
    const nd = userEvent.setup();
    veBoss(5);
    await nd.click(screen.getByRole('button', { name: /Vào trận/ }));

    danhBoss.mockResolvedValueOnce({ trangThai: 'tu-choi', thongDiep: 'Bài này đang bị khoá.' });
    const nut = screen.getAllByRole('button').find((b) => /^A\d+$/.test(b.textContent ?? ''));
    await nd.click(nut!);

    expect(screen.getByRole('alert')).toHaveTextContent('Bài này đang bị khoá.');
    expect(mau('HP Boss')).toBe(3);
  });

  it('chưa có câu nào để ôn → không có trận, nhưng vẫn đi tiếp được', () => {
    veBoss(0);
    expect(screen.getByText(/đang ngủ say/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Em đã xem xong/ })).toBeInTheDocument();
  });

  it('không có lỗi trợ năng', async () => {
    const { container } = veBoss(5);
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Presentation
// ═══════════════════════════════════════════════════════════════════════════

const GOI_Y = Array.from({ length: 8 }, (_, i) => `Gợi ý ${i + 1}`);

function veThuyetTrinh(daNop: Parameters<typeof KhoiThuyetTrinh>[0]['daNop'] = null) {
  return render(
    <KhoiThuyetTrinh
      blockId="tt1"
      tuBuoi={1}
      denBuoi={15}
      goiY={GOI_Y}
      hocSinhId="hs1"
      daNop={daNop}
    />,
  );
}

const nutNop = () => screen.getByRole('button', { name: /Nộp bài thuyết trình/ });

/** Fill slide `i` (0-based) through the real inputs. */
async function soanTrang(
  nd: ReturnType<typeof userEvent.setup>,
  i: number,
  tieuDe: string,
  noiDung: string,
) {
  await nd.click(screen.getByRole('button', { name: new RegExp(`^Trang ${i + 1}[:,]`) }));
  const td = screen.getByRole('textbox', { name: `Tiêu đề trang ${i + 1}` });
  await nd.clear(td);
  await nd.click(td);
  await nd.paste(tieuDe);
  const nd2 = screen.getByRole('textbox', { name: 'Nội dung' });
  await nd.clear(nd2);
  await nd.click(nd2);
  await nd.paste(noiDung);
}

describe('Bài thuyết trình 8 trang', () => {
  it('trống: nút nộp khoá và nói rõ trang nào còn thiếu', () => {
    veThuyetTrinh();
    expect(nutNop()).toBeDisabled();
    expect(screen.getByText(/Còn thiếu: Trang 1 chưa có tiêu đề/)).toBeInTheDocument();
    expect(screen.getByText('0/8 trang')).toBeInTheDocument();
  });

  it('7 trang chưa đủ; trang thứ 8 xong thì mở nút, nộp đúng 8 trang đã cắt khoảng trắng', async () => {
    const nd = userEvent.setup();
    veThuyetTrinh();

    for (let i = 0; i < 7; i += 1) await soanTrang(nd, i, `Tiêu đề ${i + 1}`, `- Ý ${i + 1}`);
    expect(nutNop()).toBeDisabled();
    expect(screen.getByText(/Trang 8 chưa có tiêu đề/)).toBeInTheDocument();

    await soanTrang(nd, 7, '  Tổng kết  ', 'Cảm ơn cả lớp');
    expect(screen.getByText('8/8 trang')).toBeInTheDocument();
    expect(nutNop()).toBeEnabled();

    nopThuyetTrinh.mockResolvedValue({ trangThai: 'da-nhan', thongDiep: 'ok' });
    await nd.click(nutNop());

    expect(nopThuyetTrinh).toHaveBeenCalledTimes(1);
    const [blockId, slides] = nopThuyetTrinh.mock.calls[0] as [string, Array<{ tieuDe: string }>];
    expect(blockId).toBe('tt1');
    expect(slides).toHaveLength(8);
    expect(slides[7]).toEqual({ tieuDe: 'Tổng kết', noiDung: 'Cảm ơn cả lớp' });
    expect(await screen.findByText(/Đã nộp · 8 trang/)).toBeInTheDocument();
  });

  it('xem trước: dòng "- " thành gạch đầu dòng, chữ khác là đoạn văn — không có HTML thô', async () => {
    const nd = userEvent.setup();
    veThuyetTrinh();
    await soanTrang(nd, 0, 'Vòng lặp', 'Mở đầu\n- for\n- while\n<b>đậm?</b>');

    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(expect.arrayContaining(['for', 'while']));
    // Typed markup stays text.
    expect(screen.getByText('<b>đậm?</b>')).toBeInTheDocument();
    expect(document.querySelector('b')).toBeNull();
  });

  it('bản nháp được giữ trong trình duyệt và mở lại lần sau', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const nd = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { unmount } = veThuyetTrinh();
      await soanTrang(nd, 0, 'Bản nháp', 'Chưa xong');
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      unmount();

      veThuyetTrinh();
      expect(await screen.findByText(/Đã mở lại phần em đang soạn dở/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Tiêu đề trang 1' })).toHaveValue('Bản nháp');
    } finally {
      vi.useRealTimers();
    }
  });

  it('máy chủ từ chối → giữ nguyên bài, hiện lý do', async () => {
    const nd = userEvent.setup();
    veThuyetTrinh();
    for (let i = 0; i < 8; i += 1) await soanTrang(nd, i, `T${i}`, `N${i}`);

    nopThuyetTrinh.mockResolvedValue({ trangThai: 'tu-choi', thongDiep: 'Bài học đang bị khoá.' });
    await nd.click(nutNop());

    expect(await screen.findByRole('alert')).toHaveTextContent('Bài học đang bị khoá.');
    expect(screen.getByRole('textbox', { name: /Tiêu đề trang/ })).toHaveValue('T7');
  });

  it('đã nộp: chỉ xem, chuyển trang bằng phím mũi tên', async () => {
    const nd = userEvent.setup();
    veThuyetTrinh({
      trang: Array.from({ length: 8 }, (_, i) => ({ tieuDe: `Trang số ${i + 1}`, noiDung: 'x' })),
      nopLuc: '2026-09-25T01:00:00.000Z',
    });

    expect(screen.queryByRole('button', { name: /Nộp bài thuyết trình/ })).not.toBeInTheDocument();
    expect(screen.getByText('Trang số 1')).toBeInTheDocument();

    const khung = screen.getByRole('group', { name: 'Trang 1 trên 8' });
    khung.focus();
    await nd.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByText('Trang số 3')).toBeInTheDocument();
    await nd.keyboard('{ArrowLeft}');
    expect(screen.getByText('Trang số 2')).toBeInTheDocument();
  });

  it('không có lỗi trợ năng', async () => {
    const { container } = veThuyetTrinh();
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});
