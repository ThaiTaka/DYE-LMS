/**
 * The MakeCode embed.
 *
 * The protocol functions are the interesting part: `window.addEventListener
 * ('message')` receives from ANY origin, so a page that acts on `event.data`
 * without checking `event.origin` is taking instructions from whoever managed
 * to get a frame onto it. That check gets tested directly.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  coKhoiLenh,
  dangGiuEditor,
  docWorkspace,
  giuEditor,
  GOC_MAKECODE,
  idYeuCau,
  laTinNhanHopLe,
  theoDoiChuEditor,
  traEditor,
  traLoi,
  traLoiDongBo,
  urlMakeCode,
  yeuCau,
  yeuCauNapWorkspace,
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
  it('bật chế độ điều khiển và dùng TRANG NÀY làm nơi lưu của trình soạn', () => {
    const url = urlMakeCode();
    expect(url.startsWith(GOC_MAKECODE)).toBe(true);
    expect(url).toContain('controller=1');
    /*
     * `ws=iframe`, not `ws=browser`. With `browser` the editor owns its storage
     * (IndexedDB) and never tells the host when it writes: the `workspacesave`
     * the submit path waits for was simply never sent, and every hand-in fell
     * through to "chưa đọc được khối lệnh từ trình soạn". With `iframe` the
     * parent window is the store, every write is posted up, and the child's
     * blocks still never go to a third-party cloud.
     */
    expect(url).toContain('ws=iframe');
    expect(url).not.toContain('ws=browser');
  });

  it('đổi ngôn ngữ phải là một TÀI LIỆU khác, không chỉ khác phần #hash', () => {
    /*
     * The bug this guards: two URLs that differ only in their fragment are the
     * same document to a browser, so assigning one to an <iframe src> holding
     * the other is a hash navigation — no reload, no `load` event, and a
     * MakeCode that re-routes in place with the wrong bundle and loses its
     * toolbox. The language has to live before the `#`.
     */
    const vi = new URL(urlMakeCode('vi'));
    const en = new URL(urlMakeCode('en'));

    expect(vi.searchParams.get('lang')).toBe('vi');
    expect(en.searchParams.get('lang')).toBe('en');
    // Same origin + path + hash; only the query differs — that is what makes
    // the browser treat it as a new document.
    expect(vi.hash).toBe('#editor');
    expect(en.hash).toBe('#editor');
    expect(`${vi.origin}${vi.pathname}${vi.search}`).not.toBe(
      `${en.origin}${en.pathname}${en.search}`,
    );
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

describe('Workspace có khối lệnh hay không', () => {
  const BOC = 'https://developers.google.com/blockly/xml';

  it('vỏ <xml> rỗng KHÔNG phải là có bài làm', () => {
    /*
     * The whole point. An empty MakeCode workspace is not '' — it is the
     * Blockly wrapper with nothing inside, ~55 truthy characters that sailed
     * straight through the server's `!blocksXml.trim()` check and were accepted
     * as a real submission.
     */
    expect(coKhoiLenh(`<xml xmlns="${BOC}"></xml>`)).toBe(false);
    expect(coKhoiLenh(`<xml xmlns="${BOC}"/>`)).toBe(false);
    expect(coKhoiLenh('<xml></xml>')).toBe(false);
    expect(coKhoiLenh('  <xml>\n\n</xml>  ')).toBe(false);
    expect(coKhoiLenh('')).toBe(false);
    expect(coKhoiLenh('   ')).toBe(false);
  });

  it('chỉ có khai báo biến thì cũng chưa phải là chương trình', () => {
    // MakeCode writes <variables> on its own; nothing has been dragged in yet.
    expect(coKhoiLenh(`<xml xmlns="${BOC}"><variables></variables></xml>`)).toBe(false);
    expect(coKhoiLenh(`<xml xmlns="${BOC}"><variables/></xml>`)).toBe(false);
  });

  it('có khối lệnh thì đúng là có bài làm', () => {
    expect(coKhoiLenh(`<xml xmlns="${BOC}"><block type="device_forever"/></xml>`)).toBe(true);
    expect(
      coKhoiLenh(
        `<xml xmlns="${BOC}"><variables><variable id="a">x</variable></variables>` +
          '<block type="basic_show_icon"/></xml>',
      ),
    ).toBe(true);
  });

  it('dạng lạ thì coi như CÓ bài — không bao giờ từ chối bài của học sinh vì đoán', () => {
    /*
     * Asymmetric on purpose. Wrongly calling a workspace empty refuses a
     * child's real work; wrongly calling it non-empty costs one server round
     * trip that answers politely. Only the first is unacceptable.
     */
    expect(coKhoiLenh('<workspace><block/></workspace>')).toBe(true);
    expect(coKhoiLenh('khong-phai-xml')).toBe(true);
  });

  it('bỏ qua phần khai báo XML và ghi chú', () => {
    expect(coKhoiLenh(`<?xml version="1.0"?><xml xmlns="${BOC}"></xml>`)).toBe(false);
    expect(coKhoiLenh(`<xml xmlns="${BOC}"><!-- trống --></xml>`)).toBe(false);
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
    // The editor only ever posts `{ id, success }` back when asked to. Without
    // this a submit cannot learn that its `saveproject` actually finished.
    expect(y.response).toBe(true);
  });
});

describe('Trả lời trình soạn — trang này là kho lưu của nó', () => {
  it('phản hồi mang đúng type và id của yêu cầu, để trình soạn ghép được', () => {
    /*
     * The editor matches a reply to its request by `id`, and only looks for it
     * on messages of its OWN type (`pxthost`, since it was the requester). A
     * reply sent as `pxteditor` is silently dropped and the editor waits
     * forever — on `workspacesync` that is a spinner it never gets past.
     */
    const t = traLoi('abc-1');
    expect(t.type).toBe('pxthost');
    expect(t.id).toBe('abc-1');
    expect(t.success).toBe(true);
  });

  it('trả lời workspacesync bằng danh sách rỗng', () => {
    const t = traLoiDongBo('abc-2');
    expect(t.id).toBe('abc-2');
    expect(t.success).toBe(true);
    expect(t.projects).toEqual([]);
  });

  it('nạp lại bài bằng newproject + filesOverride, kèm main.ts trống', () => {
    /*
     * `importproject` installs what it is given as-is, so it needs a full
     * `pxt.json`; the old payload sent only `main.blocks` and would have loaded
     * as an invalid package. `newproject` builds the config from MakeCode's own
     * template and lays our files over it — the same call the editor makes for
     * "import a .blocks file".
     */
    const y = yeuCauNapWorkspace(BLOCKS);
    expect(y.type).toBe('pxteditor');
    expect(y.action).toBe('newproject');
    expect(y.response).toBe(true);

    const options = y.options as { filesOverride: Record<string, string> };
    expect(options.filesOverride['main.blocks']).toBe(BLOCKS);
    // Blank on purpose: the editor regenerates TypeScript from the blocks, and a
    // program left here could only contradict them.
    expect(options.filesOverride['main.ts']?.trim()).toBe('');
    expect(JSON.stringify(y)).not.toContain('pxt.json');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sổ đăng ký "một trình soạn cho cả trang"
// ═══════════════════════════════════════════════════════════════════════════

describe('Chỉ một trình soạn được giữ cùng lúc', () => {
  beforeEach(() => {
    // Module-level state: reset so order between tests cannot matter.
    traEditor(dangGiuEditor() ?? '');
  });

  it('người giữ sau thay thế người giữ trước', () => {
    giuEditor('a');
    expect(dangGiuEditor()).toBe('a');

    giuEditor('b');
    expect(dangGiuEditor()).toBe('b');
  });

  it('giữ lại chính mình là việc không làm gì — an toàn với Strict Mode', () => {
    /*
     * React Strict Mode runs mount effects twice in development. Without this,
     * a claim/release/claim cycle would tear the iframe down and rebuild it,
     * which is precisely how MakeCode ends up with an outdated session.
     */
    const thay = vi.fn();
    const bo = theoDoiChuEditor(thay);

    giuEditor('a');
    expect(thay).toHaveBeenCalledTimes(1);

    giuEditor('a');
    expect(thay).toHaveBeenCalledTimes(1);

    bo();
  });

  it('trả lại chỉ có tác dụng với người ĐANG giữ', () => {
    // A displaced component runs its cleanup after someone else already took
    // over. An unguarded release would tear down the NEW owner's frame.
    giuEditor('a');
    giuEditor('b');

    traEditor('a');
    expect(dangGiuEditor()).toBe('b');

    traEditor('b');
    expect(dangGiuEditor()).toBeNull();
  });

  it('báo cho mọi người theo dõi, và huỷ theo dõi được', () => {
    const thay = vi.fn();
    const bo = theoDoiChuEditor(thay);

    giuEditor('a');
    expect(thay).toHaveBeenLastCalledWith('a');

    traEditor('a');
    expect(thay).toHaveBeenLastCalledWith(null);

    bo();
    giuEditor('c');
    expect(thay).toHaveBeenCalledTimes(2);

    traEditor('c');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Giao diện
// ═══════════════════════════════════════════════════════════════════════════

describe('Khu làm việc Micro:bit', () => {
  /**
   * Render the card and, by default, open the editor.
   *
   * A lesson may hold many hardware tasks and MakeCode breaks when several of
   * its editors boot at once, so the frame is lazy now. Opening it is part of
   * the normal path, which is why it happens here rather than in each test.
   */
  async function dung(props?: Partial<Record<string, unknown>>, opts: { mo?: boolean } = {}) {
    const { KhuMicrobit } = await import('./khu-microbit');
    const ket = render(
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

    if (opts.mo !== false) {
      await userEvent.setup().click(screen.getByRole('button', { name: /mở trình soạn/i }));
    }
    return ket;
  }

  /**
   * Play the editor's half of the protocol: hand a workspace back the way
   * MakeCode does, from the origin the card actually trusts.
   *
   * MakeCode emits this on every block added, moved or deleted, and again as
   * its answer to a `saveproject` request.
   */
  function editorTraBlocks(xml: string) {
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: GOC_MAKECODE,
          data: {
            type: 'pxthost',
            action: 'workspacesave',
            project: { text: { 'main.blocks': xml } },
          },
        }),
      );
    });
  }

  /** Watch what the wrapper posts INTO the editor frame. */
  function nghePostMessage(container: HTMLElement) {
    const frame = container.querySelector('iframe')!;
    return vi.spyOn(frame.contentWindow!, 'postMessage');
  }

  /** The re-hydration request (`newproject` with the blocks), if the wrapper sent one. */
  function timNhapBai(gui: ReturnType<typeof nghePostMessage>) {
    return gui.mock.calls.find(([tin]) => (tin as { action?: string }).action === 'newproject');
  }

  /** What the wrapper posted in answer to the editor request with this id. */
  function timTraLoi(gui: ReturnType<typeof nghePostMessage>, id: string) {
    return gui.mock.calls.find(([tin]) => (tin as { id?: string }).id === id);
  }

  /** Any message from the editor's side, from the origin the card trusts. */
  function editorGui(data: Record<string, unknown>) {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { origin: GOC_MAKECODE, data }));
    });
  }

  /**
   * The editor announcing it has loaded.
   *
   * MakeCode sends this on first boot and again after any reload of the frame,
   * which is the only moment the wrapper gets to put the student's blocks back.
   */
  function editorDaTai() {
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: GOC_MAKECODE,
          data: { type: 'pxthost', action: 'workspaceloaded' },
        }),
      );
    });
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
    editorTraBlocks(BLOCKS);
    await waitFor(() => expect(nopStub).toHaveBeenCalledWith('b1', BLOCKS));
  });

  it('nói rõ thầy cô sẽ chấm, không hứa hẹn chấm tự động', async () => {
    const nguoiDung = userEvent.setup();
    await dung();

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    editorTraBlocks(BLOCKS);
    // Promising an automatic verdict that is never coming would leave a student
    // waiting on a spinner forever.
    expect(await screen.findByText(/thầy cô sẽ xem/i)).toBeInTheDocument();
  });

  it('không có nút nộp khi bài không chấm điểm', async () => {
    await dung({ coBaiTap: false });
    expect(screen.queryByRole('button', { name: /nộp bài/i })).not.toBeInTheDocument();
  });

  // ── Một trình soạn cho cả trang ───────────────────────────────────────────

  it('CHƯA mở trình soạn khi vừa vào bài — nhiều khung cùng lúc làm MakeCode hỏng phiên', async () => {
    const { container } = await dung(undefined, { mo: false });

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: /mở trình soạn/i })).toBeInTheDocument();
  });

  it('mở rồi thì mới có khung, và đóng lại được', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = await dung(undefined, { mo: false });

    await nguoiDung.click(screen.getByRole('button', { name: /mở trình soạn/i }));
    expect(container.querySelector('iframe')).toBeTruthy();

    await nguoiDung.click(screen.getByRole('button', { name: /đóng trình soạn/i }));
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('nhiều bài trên một trang chỉ dựng ĐÚNG MỘT khung nhúng', async () => {
    /*
     * The regression this whole change exists for. Buổi 1 carries ten hardware
     * tasks; ten editors booting together made nine of them fail with
     * "trying to access outdated session" and show MakeCode's crash screen
     * inside the lesson.
     */
    const { KhuMicrobit } = await import('./khu-microbit');
    const nguoiDung = userEvent.setup();

    const { container } = render(
      <>
        <KhuMicrobit
          blockId="b1"
          goal="Bài 1"
          khoiLenh={[]}
          blocksXmlBanDau=""
          blocksXmlDaLuu=""
          coBaiTap
        />
        <KhuMicrobit
          blockId="b2"
          goal="Bài 2"
          khoiLenh={[]}
          blocksXmlBanDau=""
          blocksXmlDaLuu=""
          coBaiTap
        />
      </>,
    );

    // Nothing opens by itself.
    expect(container.querySelectorAll('iframe')).toHaveLength(0);

    const nut = screen.getAllByRole('button', { name: /mở trình soạn/i });
    await nguoiDung.click(nut[0]!);
    expect(container.querySelectorAll('iframe')).toHaveLength(1);

    // Handing over swaps the frame rather than adding a second one.
    await nguoiDung.click(screen.getByRole('button', { name: /chuyển trình soạn sang bài này/i }));
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('nói rõ vì sao chỉ mở được một trình soạn, và trấn an là không mất bài', async () => {
    // A student whose task-1 editor collapses when they open task 3 must be
    // told that was deliberate, and that nothing was thrown away.
    const { KhuMicrobit } = await import('./khu-microbit');
    const nguoiDung = userEvent.setup();

    render(
      <>
        <KhuMicrobit
          blockId="b1"
          goal="Bài 1"
          khoiLenh={[]}
          blocksXmlBanDau=""
          blocksXmlDaLuu=""
          coBaiTap
        />
        <KhuMicrobit
          blockId="b2"
          goal="Bài 2"
          khoiLenh={[]}
          blocksXmlBanDau=""
          blocksXmlDaLuu=""
          coBaiTap
        />
      </>,
    );

    await nguoiDung.click(screen.getAllByRole('button', { name: /mở trình soạn/i })[0]!);

    expect(screen.getByText(/chỉ mở được một trình soạn/i)).toBeInTheDocument();
    expect(screen.getByText(/KHÔNG mất gì cả/i)).toBeInTheDocument();
  });

  it('bỏ qua tin nhắn từ nguồn lạ', async () => {
    await dung();

    // A message from another origin must not be able to replace the workspace.
    await waitFor(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.example',
          data: {
            type: 'pxthost',
            action: 'workspacesave',
            project: { text: { 'main.blocks': '<xml>HACKED</xml>' } },
          },
        }),
      ),
    );

    const nguoiDung = userEvent.setup();
    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    editorTraBlocks(BLOCKS);
    await waitFor(() => expect(nopStub).toHaveBeenCalled());
    expect(nopStub).not.toHaveBeenCalledWith('b1', '<xml>HACKED</xml>');
  });

  // ── Đồng bộ khối lệnh sang bài nộp ────────────────────────────────────────

  it('khối lệnh vừa kéo vào được ghi nhận và nộp đi', async () => {
    /*
     * The plain sync path, which had no test at all: the student drags a block,
     * MakeCode autosaves, and that is what "Nộp bài" must send.
     */
    const nguoiDung = userEvent.setup();
    await dung({ blocksXmlDaLuu: '', blocksXmlBanDau: '' });

    // Nothing yet — a genuinely empty workspace.
    expect(screen.getByText(/kéo khối lệnh vào vùng làm việc/i)).toBeInTheDocument();

    const MOI = '<xml><block type="basic_show_icon"/></xml>';
    editorTraBlocks(MOI);
    expect(screen.getByText(/sẵn sàng để nộp/i)).toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    editorTraBlocks(MOI);
    await waitFor(() => expect(nopStub).toHaveBeenCalledWith('b1', MOI));
  });

  it('CHỜ trình soạn trả khối lệnh rồi mới nộp, không nộp theo trạng thái cũ', async () => {
    /*
     * The reported bug. The card used to fire `saveproject`, wait a flat 400 ms
     * and submit whatever state it happened to hold. On a school laptop the
     * editor answers later than that, so a student who had just built their
     * first program submitted an empty string — and the server, correctly, told
     * them "vùng làm việc đang trống" while their blocks sat on the screen.
     */
    const nguoiDung = userEvent.setup();
    await dung({ blocksXmlDaLuu: '', blocksXmlBanDau: '' });

    const MOI = '<xml><block type="basic_show_string"/></xml>';
    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));

    /*
     * Answer LATER than the 400 ms the old code was willing to wait. That gap
     * is the whole bug, so a test that replies inside it passes against the
     * broken version and proves nothing.
     */
    await new Promise((r) => setTimeout(r, 700));

    // Still waiting on the editor, not on a guess about how fast it is.
    expect(nopStub).not.toHaveBeenCalled();

    editorTraBlocks(MOI);
    await waitFor(() => expect(nopStub).toHaveBeenCalledWith('b1', MOI));
    expect(nopStub).not.toHaveBeenCalledWith('b1', '');
  });

  it('KHÔNG ghi đè bài làm bằng workspace rỗng', async () => {
    /*
     * MakeCode saves a project with no `main.blocks` file when it saves from the
     * JavaScript view. `docWorkspace` reports that as `{ xml: '', json: '…' }`,
     * and the old length check accepted it — wiping blocks the student could
     * still see, so the next submit was rejected as empty.
     */
    const nguoiDung = userEvent.setup();
    await dung();
    expect(screen.getByText(/sẵn sàng để nộp/i)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: GOC_MAKECODE,
          data: {
            type: 'pxthost',
            action: 'workspacesave',
            project: { text: { 'main.ts': 'basic.showIcon(IconNames.Happy)' } },
          },
        }),
      );
    });

    // The blocks are still on screen, so the card must still believe it has work.
    expect(screen.getByText(/sẵn sàng để nộp/i)).toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    editorTraBlocks(BLOCKS);
    await waitFor(() => expect(nopStub).toHaveBeenCalledWith('b1', BLOCKS));
    expect(nopStub).not.toHaveBeenCalledWith('b1', '');
  });

  // ── Dựng lại bài khi khung trình soạn tải lại ─────────────────────────────

  it('lần đầu tải thì nạp bài đã lưu vào trình soạn', async () => {
    const { container } = await dung();

    const gui = nghePostMessage(container);
    editorDaTai();

    const nhap = timNhapBai(gui);
    expect(nhap).toBeDefined();
    expect(JSON.stringify(nhap![0])).toContain('device_forever');
    // Never '*': that would hand the student's work to whatever document
    // happens to occupy the frame.
    expect(nhap![1]).toBe(GOC_MAKECODE);
  });

  // ── Trang này là kho lưu của trình soạn (ws=iframe) ───────────────────────

  it('trả lời workspacesync lúc trình soạn khởi động — không thì nó treo mãi', async () => {
    /*
     * In `ws=iframe` mode the editor's first act is to ask the host for its
     * project list, and it awaits the answer before rendering anything. The
     * reply has to carry the request's own `type` and `id`, or the editor's
     * controller files it under "unknown request" and the spinner never ends.
     */
    const { container } = await dung();
    const gui = nghePostMessage(container);

    editorGui({ type: 'pxthost', action: 'workspacesync', id: 'sync-1', response: true });

    const [tin, dich] = timTraLoi(gui, 'sync-1')!;
    expect(tin).toMatchObject({ type: 'pxthost', id: 'sync-1', success: true, projects: [] });
    expect(dich).toBe(GOC_MAKECODE);
  });

  it('xác nhận workspaceloaded và workspacereset khi trình soạn chờ trả lời', async () => {
    const { container } = await dung();
    const gui = nghePostMessage(container);

    editorGui({ type: 'pxthost', action: 'workspaceloaded', id: 'loaded-1', response: true });
    editorGui({ type: 'pxthost', action: 'workspacereset', id: 'reset-1', response: true });

    expect(timTraLoi(gui, 'loaded-1')![0]).toMatchObject({ type: 'pxthost', success: true });
    expect(timTraLoi(gui, 'reset-1')![0]).toMatchObject({ type: 'pxthost', success: true });
  });

  it('dự án trống trình soạn tự tạo lúc khởi động KHÔNG đè lên bài đã lưu', async () => {
    /*
     * The editor makes itself a blank project while booting and reports it
     * through `workspacesave` like any other write — BEFORE `workspaceloaded`.
     * Recording that would replace the saved blocks with an empty wrapper, and
     * the restore a moment later would put the empty wrapper back: the student
     * opens the lesson to an empty editor and their work looks gone.
     */
    const { container } = await dung();

    editorTraBlocks('<xml xmlns="https://developers.google.com/blockly/xml"></xml>');
    // The card must still believe it holds the saved work.
    expect(screen.getByText(/sẵn sàng để nộp/i)).toBeInTheDocument();

    const gui = nghePostMessage(container);
    editorDaTai();

    const nhap = timNhapBai(gui);
    expect(nhap).toBeDefined();
    expect(JSON.stringify(nhap![0])).toContain('device_forever');
  });

  it('sau khi đã tải, xoá hết khối lệnh là bài trống THẬT và được ghi nhận', async () => {
    // The boot-time gate must not swallow a real "I deleted everything".
    const nguoiDung = userEvent.setup();
    await dung();
    editorDaTai();

    editorTraBlocks('<xml xmlns="https://developers.google.com/blockly/xml"></xml>');

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    editorTraBlocks('<xml xmlns="https://developers.google.com/blockly/xml"></xml>');

    const loi = await screen.findByRole('status');
    expect(loi.textContent).toContain('Vùng làm việc đang trống');
    expect(nopStub).not.toHaveBeenCalled();
  });

  it('phản hồi của saveproject kết thúc việc chờ — không đợi hết thời gian', async () => {
    /*
     * The editor answers `saveproject` once the save is done. Any blocks that
     * save produced were posted first (messages from one window keep their
     * order), so on the reply the newest blocks we hold ARE the editor's state
     * — the submit goes out now instead of sitting out the timeout.
     */
    const nguoiDung = userEvent.setup();
    const { container } = await dung();
    editorDaTai();

    const gui = nghePostMessage(container);
    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));

    const luu = gui.mock.calls.find(([t]) => (t as { action?: string }).action === 'saveproject');
    expect(luu).toBeDefined();
    const { id } = luu![0] as { id: string };

    editorGui({ type: 'pxteditor', id, success: true });

    await waitFor(() => expect(nopStub).toHaveBeenCalledWith('b1', BLOCKS), { timeout: 1000 });
  });

  it('khung tải lại thì nạp lại khối lệnh MỚI NHẤT, không phải bản lúc mở trang', async () => {
    /*
     * `workspaceloaded` fires again whenever the frame reloads. Seeding it from
     * the props there re-imported the snapshot the SERVER held when the page
     * rendered, silently undoing everything the student had built since — the
     * blocks on screen visibly reverted to an earlier attempt.
     */
    const { container } = await dung();

    const MOI = '<xml><block type="basic_show_leds"/></xml>';
    editorTraBlocks(MOI);

    const gui = nghePostMessage(container);
    editorDaTai();

    const nhap = timNhapBai(gui);
    expect(nhap).toBeDefined();
    expect(JSON.stringify(nhap![0])).toContain('basic_show_leds');
    expect(JSON.stringify(nhap![0])).not.toContain('device_forever');
  });

  it('bài chưa có gì thì không nạp gì vào trình soạn', async () => {
    // Importing an empty project over a blank editor is pointless work, and
    // MakeCode answers it with its own save, which we would then have to ignore.
    const { container } = await dung({ blocksXmlDaLuu: '', blocksXmlBanDau: '' });

    const gui = nghePostMessage(container);
    editorDaTai();

    expect(timNhapBai(gui)).toBeUndefined();
  });

  // ── Đổi ngôn ngữ trình soạn ───────────────────────────────────────────────

  it('có nút chuyển VN | EN, mặc định là tiếng Việt', async () => {
    await dung();

    const vn = screen.getByRole('button', { name: 'VN' });
    const en = screen.getByRole('button', { name: 'EN' });

    expect(vn).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAttribute('aria-pressed', 'false');
  });

  it('đổi sang EN thì nạp lại khung với lang=en', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = await dung();

    expect(container.querySelector('iframe')!.getAttribute('src')).toContain('lang=vi');

    await nguoiDung.click(screen.getByRole('button', { name: 'EN' }));
    // The switch saves first and waits for the answer, so the editor has to
    // answer before the reload happens.
    editorTraBlocks(BLOCKS);

    await waitFor(() =>
      expect(container.querySelector('iframe')!.getAttribute('src')).toContain('lang=en'),
    );
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('đổi ngôn ngữ thay HẲN phần tử iframe, không chỉ ghi lại src', async () => {
    /*
     * Writing `src` on an existing frame is what a hash-only URL turns into a
     * no-op. `key={locale}` makes React discard the old element and mount a
     * new one, which is a full load whatever the URL looks like — so the
     * element identity is the thing to assert on.
     */
    const nguoiDung = userEvent.setup();
    const { container } = await dung();
    const truoc = container.querySelector('iframe');
    expect(truoc).not.toBeNull();

    await nguoiDung.click(screen.getByRole('button', { name: 'EN' }));
    editorTraBlocks(BLOCKS);

    await waitFor(() =>
      expect(container.querySelector('iframe')!.getAttribute('src')).toContain('lang=en'),
    );
    expect(container.querySelector('iframe')).not.toBe(truoc);
  });

  it('đổi ngôn ngữ KHÔNG làm mất khối lệnh đang làm', async () => {
    /*
     * A language change is a full reload of the frame — MakeCode cannot be
     * re-languaged in place. Everything the editor holds is discarded, so the
     * blocks have to be pulled into `workspaceRef` before the switch and pushed
     * back when the new frame announces itself.
     */
    const nguoiDung = userEvent.setup();
    const { container } = await dung({ blocksXmlDaLuu: '', blocksXmlBanDau: '' });

    const MOI = '<xml><block type="basic_show_number"/></xml>';
    editorTraBlocks(MOI);

    await nguoiDung.click(screen.getByRole('button', { name: 'EN' }));
    editorTraBlocks(MOI);

    await waitFor(() =>
      expect(container.querySelector('iframe')!.getAttribute('src')).toContain('lang=en'),
    );

    // The reloaded frame announces itself; the blocks must go back in.
    const gui = nghePostMessage(container);
    editorDaTai();

    const nhap = timNhapBai(gui);
    expect(nhap).toBeDefined();
    expect(JSON.stringify(nhap![0])).toContain('basic_show_number');
  });

  // ── Hai kiểu "không nộp được" là HAI chuyện khác nhau ─────────────────────

  it('trình soạn im lặng → KHÔNG nói bài trống, và không gọi máy chủ', async () => {
    /*
     * The production bug. The editor never answered, the fallback cache was
     * also empty, and the student — looking straight at their own blocks — was
     * told their workspace was empty. That message is now reserved for the case
     * where the editor actually said so.
     */
    const nguoiDung = userEvent.setup();
    await dung({ blocksXmlDaLuu: '', blocksXmlBanDau: '' });

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));

    // No reply from the editor: the wait falls through to its timeout.
    const loi = await screen.findByRole('status', {}, { timeout: 4000 });

    expect(loi.textContent).toContain('Chưa đọc được khối lệnh');
    expect(loi.textContent).not.toContain('Vùng làm việc đang trống');
    // Nothing was sent: there was nothing to send, and saying so is not the
    // server's job.
    expect(nopStub).not.toHaveBeenCalled();
  });

  it('trình soạn trả về vỏ <xml> rỗng → ĐÚNG là bài trống, nói nhẹ nhàng', async () => {
    const nguoiDung = userEvent.setup();
    await dung({ blocksXmlDaLuu: '', blocksXmlBanDau: '' });

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    editorTraBlocks('<xml xmlns="https://developers.google.com/blockly/xml"></xml>');

    const loi = await screen.findByRole('status');
    expect(loi.textContent).toContain('Vùng làm việc đang trống');
    expect(nopStub).not.toHaveBeenCalled();
  });

  it('trình soạn im lặng NHƯNG đã có bài lưu trước đó → vẫn nộp bản đó', async () => {
    // The fallback doing its job: a student who built blocks a minute ago and
    // whose editor has since gone quiet still gets their work handed in.
    const nguoiDung = userEvent.setup();
    await dung({ blocksXmlDaLuu: '', blocksXmlBanDau: '' });

    editorTraBlocks(BLOCKS);

    await nguoiDung.click(screen.getByRole('button', { name: /nộp bài cho thầy cô/i }));
    // Deliberately no answer to this saveproject.
    await waitFor(() => expect(nopStub).toHaveBeenCalledWith('b1', BLOCKS), { timeout: 4000 });
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
