/**
 * The MakeCode embed.
 *
 * The protocol functions are the interesting part: `window.addEventListener
 * ('message')` receives from ANY origin, so a page that acts on `event.data`
 * without checking `event.origin` is taking instructions from whoever managed
 * to get a frame onto it. That check gets tested directly.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  docWorkspace,
  GOC_MAKECODE,
  idYeuCau,
  laTinNhanHopLe,
  urlMakeCode,
  yeuCau,
} from './makecode';

const nopStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/bai-hoc/[slug]/code-actions', () => ({
  nopMicrobit: nopStub,
  tuDongLuu: vi.fn(),
  layBanNhap: vi.fn(),
  layLichSu: vi.fn(),
  layLichSuNop: vi.fn(),
  layNoiDungBanLuu: vi.fn(),
  khoiPhuc: vi.fn(),
  nop: vi.fn(),
}));

beforeEach(() => {
  nopStub.mockReset();
  nopStub.mockResolvedValue({
    trangThai: 'da-nhan',
    submissionId: 's1',
    attemptNo: 1,
    thongDiep: 'Đã nhận bài lần 1 của em. Thầy cô sẽ xem các khối lệnh và nhận xét.',
  });
});

const BLOCKS = '<xml><block type="device_forever"/></xml>';

// ═══════════════════════════════════════════════════════════════════════════
// Giao thức
// ═══════════════════════════════════════════════════════════════════════════

describe('Kiểm tra nguồn tin nhắn', () => {
  it('nhận tin nhắn từ đúng nguồn MakeCode', () => {
    expect(laTinNhanHopLe(GOC_MAKECODE, { type: 'pxthost', action: 'workspacesave' })).toBe(true);
    expect(laTinNhanHopLe(GOC_MAKECODE, { type: 'pxteditor', id: 'x' })).toBe(true);
  });

  it('TỪ CHỐI tin nhắn từ mọi nguồn khác', () => {
    // The boundary. Without it, any page that gets a frame onto ours could
    // drive the workspace.
    for (const goc of [
      'https://evil.example',
      'http://makecode.microbit.org',
      'https://makecode.microbit.org.evil.example',
      'https://makecode.microbit.com',
      'null',
      '',
    ]) {
      expect(laTinNhanHopLe(goc, { type: 'pxthost', action: 'workspacesave' }), goc).toBe(false);
    }
  });

  it('từ chối dữ liệu không đúng dạng giao thức, dù đúng nguồn', () => {
    for (const data of [null, undefined, 'chuoi', 42, [], { type: 'khac' }, {}]) {
      expect(laTinNhanHopLe(GOC_MAKECODE, data)).toBe(false);
    }
  });
});

describe('URL trình soạn thảo', () => {
  it('bật chế độ điều khiển và lưu trong trình duyệt', () => {
    const url = urlMakeCode();
    expect(url.startsWith(GOC_MAKECODE)).toBe(true);
    expect(url).toContain('controller=1');
    // Keeps a child's project in their own browser rather than a third-party
    // cloud account.
    expect(url).toContain('ws=browser');
  });

  it('dùng https, không tạo nội dung hỗn hợp', () => {
    // Mixed content would break the page on an https deployment.
    expect(urlMakeCode()).toMatch(/^https:\/\//);
    expect(urlMakeCode()).not.toContain('http://');
  });
});

describe('Đọc workspace từ phản hồi', () => {
  it('đọc được main.blocks', () => {
    const ws = docWorkspace({ type: 'pxthost', resp: { text: { 'main.blocks': BLOCKS } } });
    expect(ws?.xml).toBe(BLOCKS);
  });

  it('đọc được từ trường project', () => {
    const ws = docWorkspace({
      type: 'pxthost',
      action: 'workspacesave',
      project: { text: { 'main.blocks': BLOCKS, 'main.ts': 'basic.forever(...)' } },
    });
    expect(ws?.xml).toBe(BLOCKS);
    expect(ws?.json).toContain('basic.forever');
  });

  it('trả null khi không nhận ra dạng dữ liệu', () => {
    // Guessing here would store an empty workspace over a student's real work.
    expect(docWorkspace({ type: 'pxthost' })).toBeNull();
    expect(docWorkspace({ type: 'pxthost', resp: {} })).toBeNull();
    expect(docWorkspace({ type: 'pxthost', resp: { text: {} } })).toBeNull();
  });
});

describe('Mã yêu cầu', () => {
  it('mỗi yêu cầu có mã riêng để ghép với phản hồi', () => {
    const ids = new Set(Array.from({ length: 50 }, () => idYeuCau()));
    expect(ids.size).toBe(50);
  });

  it('yêu cầu mang đúng dạng giao thức', () => {
    const y = yeuCau('saveproject');
    expect(y.type).toBe('pxteditor');
    expect(y.action).toBe('saveproject');
    expect(y.id.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Giao diện
// ═══════════════════════════════════════════════════════════════════════════

describe('Khu làm việc Micro:bit', () => {
  async function dung(props?: Partial<Record<string, unknown>>) {
    const { KhuMicrobit } = await import('./khu-microbit');
    return render(
      <KhuMicrobit
        blockId="b1"
        goal="Mặt cười 0,5 giây rồi mặt khóc."
        khoiLenh={['show icon', 'pause']}
        blocksXmlBanDau=""
        blocksXmlDaLuu={BLOCKS}
        coBaiTap
        {...props}
      />,
    );
  }

  it('nhúng trình soạn thảo từ đúng nguồn makecode.microbit.org', async () => {
    const { container } = await dung();
    const frame = container.querySelector('iframe');

    expect(frame).toBeTruthy();
    expect(frame!.getAttribute('src')).toContain('https://makecode.microbit.org');
    expect(frame).toHaveAttribute('title', expect.stringContaining('MakeCode'));
  });

  it('khung nhúng bị giới hạn quyền', async () => {
    const { container } = await dung();
    const sandbox = container.querySelector('iframe')!.getAttribute('sandbox') ?? '';

    expect(sandbox).toContain('allow-scripts');
    // The frame must not be able to navigate the page the student is on.
    expect(sandbox).not.toContain('allow-top-navigation');
  });

  it('hiện mục tiêu và các khối lệnh của bài', async () => {
    await dung();
    expect(screen.getByText(/mặt cười 0,5 giây/i)).toBeInTheDocument();
    expect(screen.getByText('show icon')).toBeInTheDocument();
    expect(screen.getByText('pause')).toBeInTheDocument();
  });

  it('có hướng dẫn nạp .hex vào board thật', async () => {
    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.click(screen.getByText(/cách đưa chương trình vào board/i));
    // The step students actually get stuck on.
    expect(screen.getByText(/ổ đĩa tên là MICROBIT/i)).toBeInTheDocument();
    expect(screen.getByText(/kéo tệp .hex đó thả vào ổ đĩa MICROBIT/i)).toBeInTheDocument();
  });

  it('có phần xử lý khi board không chạy', async () => {
    const nguoiDung = userEvent.setup();
    await dung();
    await nguoiDung.click(screen.getByText(/cách đưa chương trình vào board/i));

    expect(screen.getByText(/dây USB khác/i)).toBeInTheDocument();
    // A class without hardware must still be able to do the lesson.
    expect(screen.getByText(/trình mô phỏng/i)).toBeInTheDocument();
  });

  it('nộp bài gọi đúng hành động dành cho Micro:bit', async () => {
    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    await waitFor(() => expect(nopStub).toHaveBeenCalledWith('b1', BLOCKS));
  });

  it('nói rõ thầy cô sẽ chấm, không hứa hẹn chấm tự động', async () => {
    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    // Promising an automatic verdict that is never coming would leave a student
    // waiting on a spinner forever.
    expect(await screen.findByText(/thầy cô sẽ xem/i)).toBeInTheDocument();
  });

  it('không có nút nộp khi bài không chấm điểm', async () => {
    await dung({ coBaiTap: false });
    expect(screen.queryByRole('button', { name: /nộp bài/i })).not.toBeInTheDocument();
  });

  it('bỏ qua tin nhắn từ nguồn lạ', async () => {
    await dung();

    // A message from another origin must not be able to replace the workspace.
    await waitFor(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.example',
          data: { type: 'pxthost', action: 'workspacesave', project: { text: { 'main.blocks': '<xml>HACKED</xml>' } } },
        }),
      ),
    );

    const nguoiDung = userEvent.setup();
    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    await waitFor(() => expect(nopStub).toHaveBeenCalled());
    expect(nopStub).not.toHaveBeenCalledWith('b1', '<xml>HACKED</xml>');
  });

  it('không có vi phạm axe', async () => {
    const { container } = await dung();
    const kq = await axe.run(container, {
      // jsdom cannot let axe reach into a cross-origin frame; the frame's own
      // accessible name is asserted separately above.
      iframes: false,
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });

  it('khung nhúng có tên đọc được cho trình đọc màn hình', async () => {
    const { container } = await dung();
    const frame = container.querySelector('iframe')!;
    // An untitled frame is announced as just "frame", which tells a screen
    // reader user nothing about what is inside it.
    expect(frame.getAttribute('title')?.length ?? 0).toBeGreaterThan(5);
  });
});
