'use client';

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';

import { nopMicrobit, type KetQuaNop } from '@/app/bai-hoc/[slug]/code-actions';

import {
  dangGiuEditor,
  docWorkspace,
  giuEditor,
  GIOI_HAN_WORKSPACE,
  laTinNhanHopLe,
  theoDoiChuEditor,
  traEditor,
  urlMakeCode,
  yeuCau,
} from './makecode';

export interface KhuMicrobitProps {
  blockId: string;
  goal: string;
  khoiLenh: string[];
  /** Workspace the lesson seeds the editor with. Empty means start blank. */
  blocksXmlBanDau: string;
  /** The student's last saved workspace, if they have one. */
  blocksXmlDaLuu: string;
  coBaiTap: boolean;
}

type TrangThaiEditor = 'dang-tai' | 'san-sang' | 'khong-tai-duoc';

// ═══════════════════════════════════════════════════════════════════════════
// The iframe, isolated behind memo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The MakeCode frame, and nothing else.
 *
 * Split out from the surrounding card for one reason: the card re-renders
 * constantly — every autosaved workspace, every transition tick of the submit
 * button, every status message — and each of those re-renders used to walk the
 * `<iframe>` element too. React does not tear down an iframe for an unchanged
 * `src`, but any prop churn on it risks an attribute write, and writing `src`
 * reloads the editor and destroys the student's unsaved blocks.
 *
 * The memo comparator looks at `src` ALONE. `onSanSang` is deliberately excluded
 * rather than wrapped in `useCallback`: the parent has several reasons to hand
 * down a fresh closure, and a memo that silently stops holding the first time
 * someone forgets a dependency array is worse than no memo. The callback is
 * routed through a ref inside, so it can change freely without re-rendering.
 */
const KhungMakeCode = memo(
  function KhungMakeCode({ src, onSanSang }: { src: string; onSanSang: () => void }) {
    const khung = useRef<HTMLIFrameElement | null>(null);

    // The live callback, read at event time. Keeps `onSanSang` out of the
    // comparator without letting it go stale.
    const sanSangRef = useRef(onSanSang);
    sanSangRef.current = onSanSang;

    useEffect(() => {
      /*
       * Register the frame with the parent through the module registry rather
       * than a prop, so the parent can postMessage into it without holding a
       * ref that would change identity and defeat the memo.
       *
       * The node is captured in a local rather than read from the ref again at
       * teardown: by cleanup time `khung.current` is already null, so comparing
       * against it would never match and the registry would keep pointing at a
       * detached frame — messages would then go nowhere with no error.
       */
      const el = khung.current;
      khungDangMo = el;
      return () => {
        if (khungDangMo === el) khungDangMo = null;
      };
    }, []);

    return (
      <iframe
        ref={khung}
        src={src}
        title="Trình soạn khối lệnh MakeCode cho Micro:bit"
        // Only what the editor genuinely needs. No allow-top-navigation, so
        // the frame cannot navigate the page the student is on.
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
        allow="usb; autoplay"
        className="block h-[36rem] w-full border-0 bg-the-mo"
        onLoad={() => sanSangRef.current()}
      />
    );
  },
  (truoc, sau) => truoc.src === sau.src,
);

/**
 * The single live frame, if there is one.
 *
 * Module scope for the same reason ownership is: only one exists per page, and
 * the component that needs to talk to it is not always the one that rendered
 * it during a hand-over.
 */
let khungDangMo: HTMLIFrameElement | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// The workspace card
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The Micro:bit workspace.
 *
 * Embeds the MakeCode editor and adds the two things it cannot do for us: hand
 * the student's blocks to our own submission pipeline, and explain — in words a
 * 12-year-old can follow — how to get the program onto a physical board.
 *
 * ── Why the editor does not open on its own ──────────────────────────────────
 * A lesson may carry many hardware tasks; Buổi 1 carries ten. Booting an editor
 * for each one breaks all of them — MakeCode keeps its project storage in a
 * browser session that every new instance claims, so the earlier frames start
 * failing with "trying to access outdated session" and show their own crash
 * screen inside our page. Ten copies of a ~10 MB third-party app on a school
 * laptop was not survivable either.
 *
 * So the card starts closed, and opening one closes any other. The student sees
 * the goal and the block list immediately — everything they need to read — and
 * the editor arrives when they ask for it.
 *
 * ── On the editor failing to load ────────────────────────────────────────────
 * MakeCode is a third-party site. School networks block things, and it will
 * sometimes not load. That is treated as an expected state with a visible
 * explanation and a direct link, not as a blank rectangle the student is left
 * to interpret.
 */
export const KhuMicrobit = memo(function KhuMicrobit({
  blockId,
  goal,
  khoiLenh,
  blocksXmlBanDau,
  blocksXmlDaLuu,
  coBaiTap,
}: KhuMicrobitProps) {
  const [trangThai, setTrangThai] = useState<TrangThaiEditor>('dang-tai');
  const [workspace, setWorkspace] = useState<string>(blocksXmlDaLuu || blocksXmlBanDau);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGui, batDau] = useTransition();

  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const id = useId();

  /*
   * Who currently holds the editor, read from the module registry.
   *
   * `useSyncExternalStore` rather than a `useEffect` + `useState` pair, because
   * this value is read during render to decide whether to mount the frame at
   * all. The effect version would render one frame with the stale answer, which
   * for an iframe means mounting and immediately unmounting an editor — exactly
   * the churn that produces the outdated-session error.
   *
   * The server snapshot is `null`: nothing owns the editor before hydration, so
   * the closed placeholder is what gets serialised and the trees match.
   */
  const chuSoHuu = useSyncExternalStore(theoDoiChuEditor, dangGiuEditor, () => null);
  const dangMo = chuSoHuu === id;

  // Stable across every render, so the memo on the frame actually holds.
  const src = useMemo(() => urlMakeCode(), []);

  /** Send a request into the editor, targeted at the MakeCode origin only. */
  const guiToiEditor = useCallback((action: string, them: Record<string, unknown> = {}) => {
    // Never '*': that would broadcast the message to whatever document happens
    // to occupy the frame.
    khungDangMo?.contentWindow?.postMessage(
      yeuCau(action, them),
      'https://makecode.microbit.org',
    );
  }, []);

  /** Take the editor. Whoever had it releases it and goes back to a placeholder. */
  const moEditor = useCallback(() => {
    setTrangThai('dang-tai');
    giuEditor(id);
  }, [id]);

  const dongEditor = useCallback(() => traEditor(id), [id]);

  // Release on unmount, so navigating away frees the editor for the next page.
  useEffect(() => () => traEditor(id), [id]);

  useEffect(() => {
    if (!dangMo) return;

    const nhan = (e: MessageEvent): void => {
      // The security boundary: a message from any other origin is ignored
      // entirely, before its contents are looked at.
      if (!laTinNhanHopLe(e.origin, e.data)) return;

      const data = e.data;

      if (data.type === 'pxthost' && data.action === 'workspaceloaded') {
        setTrangThai('san-sang');
        if (blocksXmlDaLuu || blocksXmlBanDau) {
          guiToiEditor('importproject', {
            project: { text: { 'main.blocks': blocksXmlDaLuu || blocksXmlBanDau } },
          });
        }
        return;
      }

      if (data.type === 'pxthost' && data.action === 'workspacesave') {
        const ws = docWorkspace(data);
        // A null read means the shape was not recognised. Keeping the previous
        // value beats overwriting a student's work with an empty workspace.
        if (ws && ws.xml.length <= GIOI_HAN_WORKSPACE) setWorkspace(ws.xml);
        return;
      }

      if (data.id && data.success === true) {
        const ws = docWorkspace(data);
        if (ws && ws.xml.length <= GIOI_HAN_WORKSPACE) setWorkspace(ws.xml);
      }
    };

    window.addEventListener('message', nhan);
    return () => window.removeEventListener('message', nhan);
  }, [dangMo, blocksXmlBanDau, blocksXmlDaLuu, guiToiEditor]);

  // The editor is third-party and sometimes simply does not arrive. Only armed
  // while this card actually holds the frame.
  useEffect(() => {
    if (!dangMo) return;
    const t = setTimeout(() => {
      setTrangThai((cu) => (cu === 'dang-tai' ? 'khong-tai-duoc' : cu));
    }, 15_000);
    return () => clearTimeout(t);
  }, [dangMo]);

  const nop = useCallback(() => {
    // Ask for the newest workspace, then submit what we have. The request is
    // best-effort: if the editor does not answer, the last saved state is still
    // a real answer and the student's press of "Nộp bài" still means something.
    guiToiEditor('saveproject');

    batDau(async () => {
      await new Promise((r) => setTimeout(r, 400));
      const kq: KetQuaNop = await nopMicrobit(blockId, workspaceRef.current);
      setThongBao({ ok: kq.trangThai === 'da-nhan', chu: kq.thongDiep });
    });
  }, [blockId, guiToiEditor]);

  const sanSang = useCallback(() => {
    setTrangThai((cu) => (cu === 'dang-tai' ? 'san-sang' : cu));
  }, []);

  return (
    <div className="rounded-nut border border-vien bg-the">
      <div className="border-b border-vien px-4 py-3">
        <p className="mt-0 mb-2 text-sm">
          <strong>Mục tiêu:</strong> {goal}
        </p>

        {khoiLenh.length > 0 ? (
          <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-chu-phu">Khối lệnh dùng trong bài:</span>
            {khoiLenh.map((k) => (
              <code
                key={k}
                className="rounded border border-vien bg-the-mo px-2 py-0.5 font-mono text-xs"
              >
                {k}
              </code>
            ))}
          </p>
        ) : null}
      </div>

      {!dangMo ? (
        <ChuaMo
          daCoNguoiKhac={chuSoHuu !== null}
          daCoBaiLam={workspace !== ''}
          onMo={moEditor}
        />
      ) : trangThai === 'khong-tai-duoc' ? (
        <TaiKhongDuoc />
      ) : (
        <div className="relative">
          {trangThai === 'dang-tai' ? (
            <p
              aria-live="polite"
              className="absolute inset-x-0 top-0 z-10 m-0 bg-chinh-nhat px-4 py-2 text-sm text-chinh"
            >
              Đang mở trình soạn khối lệnh MakeCode… lần đầu có thể hơi lâu một chút.
            </p>
          ) : null}

          <KhungMakeCode src={src} onSanSang={sanSang} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-vien px-4 py-3">
        {coBaiTap ? (
          <button
            type="button"
            onClick={nop}
            disabled={dangGui || !dangMo}
            className="min-h-cham rounded-nut bg-chinh px-5 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
          >
            {dangGui ? 'Đang gửi…' : 'Nộp bài cho thầy cô'}
          </button>
        ) : null}

        {dangMo ? (
          <button
            type="button"
            onClick={dongEditor}
            className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
          >
            Đóng trình soạn
          </button>
        ) : null}

        <p className="m-0 text-sm text-chu-nhat">
          {!dangMo
            ? 'Mở trình soạn ở trên để làm bài này.'
            : workspace
              ? 'Bài của em đã sẵn sàng để nộp.'
              : 'Em kéo khối lệnh vào vùng làm việc nhé.'}
        </p>
      </div>

      {thongBao ? (
        <p
          role="status"
          className={`m-0 border-t border-vien px-4 py-2.5 text-sm ${
            thongBao.ok ? 'bg-dung-nen text-dung' : 'bg-thu-lai-nen text-thu-lai'
          }`}
        >
          <span aria-hidden="true">{thongBao.ok ? '✓ ' : '! '}</span>
          {thongBao.chu}
        </p>
      ) : null}

      <HuongDanNap id={`${id}-nap`} />
    </div>
  );
});

/**
 * The closed state.
 *
 * Explains WHY only one editor opens at a time, because a student who clicks
 * "mở" on task 3 and watches task 1 collapse deserves to know that was
 * deliberate rather than a fault. The reassurance about saved work is the part
 * that matters most: closing an editor here never discards blocks, and a child
 * who believes otherwise will not dare click anything.
 */
function ChuaMo({
  daCoNguoiKhac,
  daCoBaiLam,
  onMo,
}: {
  daCoNguoiKhac: boolean;
  daCoBaiLam: boolean;
  onMo: () => void;
}) {
  return (
    <div className="px-4 py-6 text-center">
      <p aria-hidden="true" className="m-0 text-4xl">
        🧩
      </p>
      <p className="mt-3 mb-1 font-semibold">
        {daCoBaiLam ? 'Em đã có bài làm ở đây' : 'Trình soạn khối lệnh chưa mở'}
      </p>
      <p className="mx-auto mt-0 mb-4 max-w-prose text-sm text-chu-phu">
        {daCoNguoiKhac
          ? 'Mỗi lúc chỉ mở được một trình soạn khối lệnh trên trang — mở nhiều cùng lúc thì MakeCode sẽ báo lỗi. Bấm nút dưới đây để chuyển trình soạn sang bài này; bài đang mở sẽ đóng lại và KHÔNG mất gì cả.'
          : 'Bấm để mở trình soạn khối lệnh cho bài này. Mở một bài thôi cho máy nhẹ và cho MakeCode chạy ổn định.'}
      </p>
      <button
        type="button"
        onClick={onMo}
        className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
      >
        {daCoNguoiKhac ? 'Chuyển trình soạn sang bài này' : 'Mở trình soạn khối lệnh'}
      </button>
    </div>
  );
}

/**
 * Getting the program onto the board.
 *
 * Written as numbered physical steps because that is what it is — plugging in a
 * cable and dragging a file. The step students get stuck on is recognising that
 * MICROBIT appears as a USB drive, so it is called out explicitly.
 */
function HuongDanNap({ id }: { id: string }) {
  return (
    <details className="border-t border-vien">
      <summary className="min-h-cham cursor-pointer px-4 py-3 font-semibold">
        🔌 Cách đưa chương trình vào board Micro:bit
      </summary>

      <div id={id} className="border-t border-vien px-4 py-4">
        <ol className="m-0 space-y-3 ps-5">
          <li>
            <strong>Cắm dây USB</strong> nối Micro:bit với máy tính. Đèn nhỏ màu vàng ở mặt sau
            board sẽ sáng lên.
          </li>
          <li>
            Máy tính sẽ hiện thêm <strong>một ổ đĩa tên là MICROBIT</strong> — giống như khi em
            cắm USB. Nếu chưa thấy, em thử rút ra cắm lại, hoặc đổi cổng USB khác.
          </li>
          <li>
            Trong trình soạn khối lệnh ở trên, bấm nút <strong>Download</strong> (hoặc{' '}
            <strong>Tải xuống</strong>) ở góc dưới bên trái. Máy tính sẽ tải về một tệp có đuôi{' '}
            <code className="rounded border border-vien bg-the-mo px-1.5 py-0.5 font-mono text-xs">
              .hex
            </code>
            .
          </li>
          <li>
            <strong>Kéo tệp .hex đó thả vào ổ đĩa MICROBIT.</strong> Đèn vàng sẽ nhấp nháy vài
            giây — đó là lúc chương trình đang được nạp.
          </li>
          <li>
            Đèn ngừng nhấp nháy là xong. <strong>Chương trình của em bắt đầu chạy ngay.</strong>
          </li>
        </ol>

        <div className="mt-4 rounded-nut bg-thu-lai-nen p-3.5 text-sm">
          <p className="mt-0 mb-1.5 font-semibold text-thu-lai">Nếu chưa chạy được</p>
          <ul className="m-0 space-y-1 ps-5 text-chu-phu">
            <li>Ổ MICROBIT không hiện ra → thử dây USB khác. Có loại dây chỉ sạc, không truyền dữ liệu.</li>
            <li>Đã thả tệp nhưng board không đổi → kiểm tra em đã thả đúng tệp `.hex` mới nhất chưa.</li>
            <li>Không có board ở lớp → em vẫn chạy thử được bằng trình mô phỏng bên trái trong MakeCode.</li>
          </ul>
        </div>
      </div>
    </details>
  );
}

/** The editor did not load. Say so, and give a way forward. */
function TaiKhongDuoc() {
  return (
    <div className="p-6">
      <p className="mt-0 mb-2 font-semibold">Chưa mở được trình soạn khối lệnh</p>
      <p className="mt-0 mb-4 text-chu-phu">
        Trình soạn khối lệnh nằm ở trang makecode.microbit.org. Mạng của trường đôi khi chặn trang
        này. Em thử mở trực tiếp bằng nút dưới đây, làm bài ở đó rồi quay lại nộp nhé.
      </p>
      <a
        href="https://makecode.microbit.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
      >
        Mở MakeCode ở tab mới
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}
