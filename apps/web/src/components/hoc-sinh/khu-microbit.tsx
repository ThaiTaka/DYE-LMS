'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';

import { nopMicrobit, type KetQuaNop } from '@/app/bai-hoc/[slug]/code-actions';

import {
  docWorkspace,
  GIOI_HAN_WORKSPACE,
  laTinNhanHopLe,
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

/**
 * The Micro:bit workspace.
 *
 * Embeds the MakeCode editor and adds the two things it cannot do for us: hand
 * the student's blocks to our own submission pipeline, and explain — in words a
 * 12-year-old can follow — how to get the program onto a physical board.
 *
 * ── On the editor failing to load ────────────────────────────────────────────
 * MakeCode is a third-party site. School networks block things, and it will
 * sometimes not load. That is treated as an expected state with a visible
 * explanation and a direct link, not as a blank rectangle the student is left
 * to interpret.
 */
export function KhuMicrobit({
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

  const khung = useRef<HTMLIFrameElement | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const id = useId();

  /** Send a request into the editor, targeted at the MakeCode origin only. */
  const guiToiEditor = useCallback((action: string, them: Record<string, unknown> = {}) => {
    // Never '*': that would broadcast the message to whatever document happens
    // to occupy the frame.
    khung.current?.contentWindow?.postMessage(yeuCau(action, them), 'https://makecode.microbit.org');
  }, []);

  useEffect(() => {
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
  }, [blocksXmlBanDau, blocksXmlDaLuu, guiToiEditor]);

  // The editor is third-party and sometimes simply does not arrive.
  useEffect(() => {
    const t = setTimeout(() => {
      setTrangThai((cu) => (cu === 'dang-tai' ? 'khong-tai-duoc' : cu));
    }, 15_000);
    return () => clearTimeout(t);
  }, []);

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

      {trangThai === 'khong-tai-duoc' ? (
        <TaiKhongDuoc />
      ) : (
        <div className="relative">
          {trangThai === 'dang-tai' ? (
            <p
              aria-live="polite"
              className="absolute inset-x-0 top-0 m-0 bg-chinh-nhat px-4 py-2 text-sm text-chinh"
            >
              Đang mở trình soạn khối lệnh MakeCode… lần đầu có thể hơi lâu một chút.
            </p>
          ) : null}

          <iframe
            ref={khung}
            src={urlMakeCode()}
            title="Trình soạn khối lệnh MakeCode cho Micro:bit"
            // Only what the editor genuinely needs. No allow-top-navigation, so
            // the frame cannot navigate the page the student is on.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
            allow="usb; autoplay"
            className="block h-[36rem] w-full border-0 bg-the-mo"
            onLoad={() => setTrangThai((cu) => (cu === 'dang-tai' ? 'san-sang' : cu))}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-vien px-4 py-3">
        {coBaiTap ? (
          <button
            type="button"
            onClick={nop}
            disabled={dangGui}
            className="min-h-cham rounded-nut bg-chinh px-5 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
          >
            {dangGui ? 'Đang gửi…' : 'Nộp bài cho thầy cô'}
          </button>
        ) : null}

        <p className="m-0 text-sm text-chu-nhat">
          {workspace ? 'Bài của em đã sẵn sàng để nộp.' : 'Em kéo khối lệnh vào vùng làm việc nhé.'}
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
