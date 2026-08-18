/**
 * Turning a container's exit into a verdict, and a Python traceback into
 * something a 12-year-old can act on.
 *
 * ── The security rule ────────────────────────────────────────────────────────
 * Nothing from the host ever reaches a student. Container paths, worker
 * internals, image names and Docker's own errors are stripped here and kept in
 * `runnerError`, which is teacher/admin-only. A student sees the exception type,
 * the line number in THEIR file, and a sentence in Vietnamese.
 *
 * ── The pedagogical rule ─────────────────────────────────────────────────────
 * The friendly message names what to look at, never what the student is. There
 * is no "sai rồi" here; there is "dòng 4: thiếu dấu hai chấm".
 */
import type { KetThuc } from './sandbox';
import type { Verdict } from '@prisma/client';

/** Map a sandbox outcome to a verdict, before output is even compared. */
export function phanLoaiKetThuc(ketThuc: KetThuc, exitCode: number | null): Verdict | null {
  switch (ketThuc) {
    case 'het-gio':
      return 'TIME_LIMIT_EXCEEDED';
    case 'het-bo-nho':
      return 'MEMORY_LIMIT_EXCEEDED';
    case 'qua-nhieu-dau-ra':
      return 'OUTPUT_LIMIT_EXCEEDED';
    case 'khong-chay-duoc':
      return 'INTERNAL_ERROR';
    case 'binh-thuong':
      // A non-zero exit is the program failing, not the sandbox failing.
      return exitCode === 0 ? null : 'RUNTIME_ERROR';
    default: {
      const unreachable: never = ketThuc;
      void unreachable;
      return 'INTERNAL_ERROR';
    }
  }
}

/**
 * A syntax error is not a runtime error.
 *
 * Python raises `SyntaxError` / `IndentationError` before executing a single
 * line, so it maps to COMPILE_ERROR. The distinction matters to a beginner: one
 * means "the computer could not read your program", the other means "your
 * program ran and then went wrong". Those need different next actions.
 */
export function laLoiCuPhap(stderr: string): boolean {
  return /^\s*(SyntaxError|IndentationError|TabError)\b/m.test(stderr);
}

/** Vietnamese explanations, keyed on the exception name Python printed. */
const GIAI_THICH: Array<{ re: RegExp; noi: (m: RegExpMatchArray) => string }> = [
  {
    re: /^\s*IndentationError: (.+)$/m,
    noi: () =>
      'Thụt lề chưa đúng. Trong Python, các dòng cùng một khối phải thụt vào bằng nhau — thường là 4 dấu cách.',
  },
  {
    re: /^\s*TabError: (.+)$/m,
    noi: () =>
      'Bài của em đang trộn cả dấu Tab và dấu cách để thụt lề. Em chọn một kiểu thôi nhé — khung soạn thảo dùng 4 dấu cách.',
  },
  {
    re: /^\s*SyntaxError: (.+)$/m,
    noi: () =>
      'Python chưa đọc được chương trình. Em kiểm tra lại dấu hai chấm ở cuối dòng, dấu ngoặc đã đóng đủ chưa, và dấu nháy của chuỗi nhé.',
  },
  {
    re: /^\s*NameError: name '([^']+)'/m,
    noi: (m) =>
      `Python không tìm thấy tên "${m[1]}". Có thể em gõ nhầm tên biến, hoặc dùng nó trước khi tạo ra nó.`,
  },
  {
    re: /^\s*TypeError: (.+)$/m,
    noi: () =>
      'Có phép toán đang dùng sai kiểu dữ liệu — ví dụ cộng một số với một chuỗi. Em thử dùng int() hoặc str() để đổi kiểu nhé.',
  },
  {
    re: /^\s*ValueError: (.+)$/m,
    noi: () =>
      'Giá trị đưa vào không dùng được — ví dụ int("abc"). Em kiểm tra lại dữ liệu trước khi chuyển kiểu nhé.',
  },
  {
    re: /^\s*ZeroDivisionError/m,
    noi: () => 'Chương trình đang chia cho 0. Em kiểm tra mẫu số trước khi chia nhé.',
  },
  {
    re: /^\s*IndexError/m,
    noi: () =>
      'Em đang lấy phần tử ở vị trí không tồn tại trong danh sách. Nhớ là vị trí đầu tiên là 0, và vị trí cuối là độ dài trừ 1.',
  },
  {
    re: /^\s*KeyError: (.+)$/m,
    noi: (m) => `Từ điển không có khoá ${m[1]}. Em kiểm tra lại tên khoá nhé.`,
  },
  {
    re: /^\s*AttributeError: (.+)$/m,
    noi: () =>
      'Em đang gọi một thuộc tính hoặc phương thức mà đối tượng này không có. Kiểm tra lại tên viết đúng chưa nhé.',
  },
  {
    re: /^\s*RecursionError/m,
    noi: () =>
      'Hàm đang gọi chính nó mãi không dừng. Em kiểm tra lại điều kiện dừng của đệ quy nhé.',
  },
  {
    re: /^\s*ModuleNotFoundError: No module named '([^']+)'/m,
    noi: (m) =>
      `Không có thư viện "${m[1]}" trong môi trường chấm bài. Em chỉ dùng các thư viện có sẵn của Python nhé.`,
  },
  {
    re: /^\s*EOFError/m,
    noi: () =>
      'Chương trình đang chờ nhập thêm dữ liệu nhưng đã hết đầu vào. Em kiểm tra số lần gọi input() nhé.',
  },
];

/**
 * Strip everything that is about the machine rather than the program.
 *
 * The sandbox path `/sandbox/` is removed so the student sees `main.py`, and
 * frames from the driver we injected are dropped entirely — they did not write
 * that file and cannot fix it.
 */
export function locVetLoi(stderr: string): string {
  return stderr
    .split('\n')
    .filter((d) => !d.includes('/usr/local/lib/python'))
    .filter((d) => !d.includes('_dye_driver'))
    .map((d) => d.replace(/\/sandbox\//g, '').replace(/File "([^"]*)"/g, 'File "$1"'))
    .join('\n')
    .trim();
}

export interface LoiThanThien {
  /** One or two sentences, safe to show a student. */
  thongDiep: string;
  /** Line number in the student's own file, when Python reported one. */
  dong: number | null;
  /** Exception class name, e.g. "NameError". */
  loai: string | null;
}

export function giaiThichLoi(stderr: string): LoiThanThien {
  const sach = locVetLoi(stderr);

  // Last frame that points at the student's own file.
  const dongMatch = [...sach.matchAll(/File "([^"]*main\.py|[^"]*solution\.py)", line (\d+)/g)].at(
    -1,
  );
  const dong = dongMatch ? Number(dongMatch[2]) : null;

  const loaiMatch = sach.match(/^\s*([A-Z]\w*Error|[A-Z]\w*Exception)\b/m);
  const loai = loaiMatch ? (loaiMatch[1] ?? null) : null;

  for (const { re, noi } of GIAI_THICH) {
    const m = sach.match(re);
    if (m) {
      const viTri = dong ? ` (khoảng dòng ${dong})` : '';
      return { thongDiep: `${noi(m)}${viTri}`, dong, loai };
    }
  }

  if (loai) {
    return {
      thongDiep: `Chương trình dừng giữa chừng vì lỗi ${loai}${dong ? ` ở khoảng dòng ${dong}` : ''}. Em đọc lại đoạn đó nhé.`,
      dong,
      loai,
    };
  }

  return {
    thongDiep: 'Chương trình dừng giữa chừng. Em thử chạy lại từng phần để tìm chỗ sai nhé.',
    dong: null,
    loai: null,
  };
}

/** Truncate anything stored, so one runaway program cannot bloat a row. */
export function catBot(s: string, toiDa = 4096): string {
  return s.length <= toiDa ? s : `${s.slice(0, toiDa)}\n… (đã cắt bớt)`;
}
