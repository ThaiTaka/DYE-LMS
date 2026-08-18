/**
 * Upload validation.
 *
 * These are the tests that decide whether a school can safely let children
 * upload files to a shared server. They assume the bytes are hostile, because
 * the endpoint is reachable by anyone with an account and a shared classroom
 * machine means an account is not the same thing as a person.
 */
import { describe, expect, it } from 'vitest';

import {
  coShebang,
  conDuDungLuong,
  DINH_DANG_CHO_PHEP,
  GIOI_HAN_DU_AN_BYTE,
  GIOI_HAN_TEP_BYTE,
  kiemTraDuongDan,
  kiemTraTepTai,
  laVanBanUtf8,
  layDuoi,
  nguiMime,
  nhanDangThucThi,
} from './upload-guard';

/** Minimal valid file bodies, byte-accurate. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
const WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
]);
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
const ELF = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

const chu = (s: string): Uint8Array => new TextEncoder().encode(s);
const PY = chu('import pygame\npygame.init()\n');

// ═══════════════════════════════════════════════════════════════════════════
// Tệp thực thi
// ═══════════════════════════════════════════════════════════════════════════

describe('Từ chối tệp thực thi', () => {
  it('nhận ra ELF, PE, Mach-O, Java, WASM', () => {
    expect(nhanDangThucThi(ELF)).toBe('ELF');
    expect(nhanDangThucThi(EXE)).toBe('PE/EXE');
    expect(nhanDangThucThi(new Uint8Array([0xcf, 0xfa, 0xed, 0xfe]))).toBe('Mach-O');
    expect(nhanDangThucThi(new Uint8Array([0xca, 0xfe, 0xba, 0xbe]))).toBe('Java class');
    expect(nhanDangThucThi(new Uint8Array([0x00, 0x61, 0x73, 0x6d]))).toBe('WASM');
  });

  it('từ chối .exe theo tên', () => {
    const kq = kiemTraTepTai('game.exe', EXE);
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('thuc-thi');
  });

  it('từ chối tệp thực thi ĐỔI TÊN thành .png', () => {
    // The case that matters: the name says image, the bytes say binary. Content
    // decides, and the error names what it actually is.
    const kq = kiemTraTepTai('assets/player.png', ELF);
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('thuc-thi');
    expect(kq.lyDo).toContain('ELF');
  });

  it('từ chối .sh', () => {
    const kq = kiemTraTepTai('chay.sh', chu('rm -rf /\n'));
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('duoi-khong-cho-phep');
  });

  it('từ chối tệp bắt đầu bằng shebang, kể cả khi đuôi là .py', () => {
    // `#!` at byte zero is what makes a file executable to a kernel, whatever
    // the extension says.
    expect(coShebang(chu('#!/bin/sh\necho hi\n'))).toBe(true);

    const kq = kiemTraTepTai('main.py', chu('#!/usr/bin/env python\nprint(1)\n'));
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('shebang');
  });

  it('từ chối kho nén — đó là cách lách mọi kiểm tra khác', () => {
    for (const [ten, data] of [
      ['tai-nguyen.zip', ZIP],
      ['x.gz', new Uint8Array([0x1f, 0x8b, 0x08, 0x00])],
    ] as const) {
      const kq = kiemTraTepTai(ten, data);
      expect(kq.ok, ten).toBe(false);
    }
    // Even disguised as an allowed extension.
    expect(kiemTraTepTai('anh.png', ZIP).ma).toBe('thuc-thi');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Kích thước
// ═══════════════════════════════════════════════════════════════════════════

describe('Giới hạn kích thước', () => {
  it('từ chối tệp lớn hơn 5 MB', () => {
    const to = new Uint8Array(GIOI_HAN_TEP_BYTE + 1);
    to.set(PNG, 0);

    const kq = kiemTraTepTai('anh.png', to);
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('qua-lon');
    expect(kq.lyDo).toContain('5 MB');
  });

  it('nhận tệp vừa đúng giới hạn', () => {
    const vua = new Uint8Array(GIOI_HAN_TEP_BYTE);
    vua.set(PNG, 0);
    expect(kiemTraTepTai('anh.png', vua).ok).toBe(true);
  });

  it('từ chối tệp rỗng', () => {
    expect(kiemTraTepTai('anh.png', new Uint8Array(0)).ma).toBe('rong');
  });

  it('chặn khi dự án hết dung lượng', () => {
    const gan = GIOI_HAN_DU_AN_BYTE - 1000;
    expect(conDuDungLuong(gan, 500).ok).toBe(true);
    expect(conDuDungLuong(gan, 5000).ok).toBe(false);
    expect(conDuDungLuong(gan, 5000).lyDo).toContain('50 MB');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Đường dẫn
// ═══════════════════════════════════════════════════════════════════════════

describe('Đường dẫn hiển thị', () => {
  it('chấp nhận đường dẫn bình thường', () => {
    expect(kiemTraDuongDan('main.py').duongDan).toBe('main.py');
    expect(kiemTraDuongDan('assets/player.png').duongDan).toBe('assets/player.png');
    expect(kiemTraDuongDan('am-thanh/no/bum.wav').duongDan).toBe('am-thanh/no/bum.wav');
  });

  it('chặn thoát thư mục bằng ..', () => {
    for (const xau of [
      '../../etc/passwd',
      'assets/../../../secret',
      '..',
      'a/./../../b',
    ]) {
      expect(kiemTraDuongDan(xau).ok, xau).toBe(false);
    }
  });

  it('chặn thoát thư mục dùng dấu gạch ngược của Windows', () => {
    // Normalised before inspection, so `..\..\` is seen for what it is.
    expect(kiemTraDuongDan('assets\\..\\..\\x').ok).toBe(false);
    expect(kiemTraDuongDan('..\\..\\Windows\\System32').ok).toBe(false);
  });

  it('chặn đường dẫn tuyệt đối', () => {
    expect(kiemTraDuongDan('/etc/passwd').ok).toBe(false);
    expect(kiemTraDuongDan('C:/Windows/x.png').ok).toBe(false);
    expect(kiemTraDuongDan('C:\\Windows\\x.png').ok).toBe(false);
  });

  it('chặn ký tự NUL và ký tự điều khiển', () => {
    expect(kiemTraDuongDan('a\0b.png').ok).toBe(false);
    expect(kiemTraDuongDan('a\nb.png').ok).toBe(false);
  });

  it('chặn tên dành riêng của Windows', () => {
    // `CON.png` is still the console device on Windows.
    expect(kiemTraDuongDan('CON.png').ok).toBe(false);
    expect(kiemTraDuongDan('assets/nul.wav').ok).toBe(false);
    expect(kiemTraDuongDan('com1.py').ok).toBe(false);
  });

  it('chặn tên kết thúc bằng dấu chấm hoặc dấu cách', () => {
    expect(kiemTraDuongDan('main.py.').ok).toBe(false);
    expect(kiemTraDuongDan('main.py ').duongDan).toBe('main.py');
  });

  it('chặn lồng thư mục quá sâu', () => {
    expect(kiemTraDuongDan('a/b/c/d/e/f/g/h.png').ok).toBe(false);
  });

  it('chặn đường dẫn quá dài', () => {
    expect(kiemTraDuongDan(`${'a'.repeat(300)}.png`).ok).toBe(false);
  });

  it('gộp dấu gạch chéo thừa', () => {
    expect(kiemTraDuongDan('assets//player.png').duongDan).toBe('assets/player.png');
  });
});

describe('layDuoi', () => {
  it('lấy đúng đuôi, không phân biệt hoa thường', () => {
    expect(layDuoi('a/b/PLAYER.PNG')).toBe('png');
    expect(layDuoi('main.py')).toBe('py');
  });

  it('tệp không có đuôi trả về chuỗi rỗng', () => {
    expect(layDuoi('README')).toBe('');
    // A leading dot is a hidden file, not an extension.
    expect(layDuoi('.gitignore')).toBe('');
  });

  it('lấy đuôi cuối cùng khi có nhiều dấu chấm', () => {
    expect(layDuoi('anh.tar.gz')).toBe('gz');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Khớp nội dung
// ═══════════════════════════════════════════════════════════════════════════

describe('Nội dung phải khớp với đuôi tệp', () => {
  it('nhận đúng các định dạng ảnh và âm thanh hợp lệ', () => {
    expect(kiemTraTepTai('a.png', PNG).ok).toBe(true);
    expect(kiemTraTepTai('a.jpg', JPEG).ok).toBe(true);
    expect(kiemTraTepTai('a.gif', GIF).ok).toBe(true);
    expect(kiemTraTepTai('a.wav', WAV).ok).toBe(true);
    expect(kiemTraTepTai('a.ogg', OGG).ok).toBe(true);
  });

  it('từ chối .png mà bên trong là JPEG', () => {
    const kq = kiemTraTepTai('a.png', JPEG);
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('khong-khop-noi-dung');
    // The message tells a student what to actually do.
    expect(kq.lyDo).toContain('image/jpeg');
  });

  it('từ chối tệp ảnh mà nội dung không phải ảnh gì cả', () => {
    expect(kiemTraTepTai('a.png', chu('day chi la chu thoi')).ma).toBe('khong-khop-noi-dung');
  });

  it('MIME do nội dung quyết định, không phải do tên', () => {
    expect(nguiMime(PNG)).toBe('image/png');
    expect(nguiMime(WAV)).toBe('audio/wav');
    expect(nguiMime(chu('xin chao'))).toBeNull();
  });

  it('nhận .py là văn bản UTF-8', () => {
    const kq = kiemTraTepTai('main.py', PY);
    expect(kq.ok).toBe(true);
    expect(kq.dinhDang?.laVanBan).toBe(true);
  });

  it('nhận .py có tiếng Việt có dấu', () => {
    expect(kiemTraTepTai('main.py', chu('# Trò chơi của em\nprint("Chào")\n')).ok).toBe(true);
  });

  it('từ chối .py chứa dữ liệu nhị phân', () => {
    const kq = kiemTraTepTai('main.py', new Uint8Array([0x50, 0x00, 0x01, 0x02]));
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('khong-phai-van-ban');
  });

  it('từ chối .json không phải UTF-8 hợp lệ', () => {
    expect(kiemTraTepTai('data.json', new Uint8Array([0xff, 0xfe, 0x00])).ok).toBe(false);
  });

  it('laVanBanUtf8 chặn NUL và byte hỏng', () => {
    expect(laVanBanUtf8(chu('xin chao'))).toBe(true);
    expect(laVanBanUtf8(new Uint8Array([0x61, 0x00, 0x62]))).toBe(false);
    expect(laVanBanUtf8(new Uint8Array([0xff, 0xfe]))).toBe(false);
  });
});

describe('Danh sách trắng định dạng', () => {
  it('từ chối mọi đuôi không nằm trong danh sách', () => {
    for (const xau of ['x.svg', 'x.html', 'x.js', 'x.bat', 'x.dll', 'x.so', 'x.pyc']) {
      const kq = kiemTraTepTai(xau, chu('noi dung'));
      expect(kq.ok, xau).toBe(false);
      expect(kq.ma, xau).toBe('duoi-khong-cho-phep');
    }
  });

  it('SVG bị từ chối — nó có thể chứa script', () => {
    // SVG is an XML document that browsers execute scripts from. It looks like
    // an image and is not one.
    expect(kiemTraTepTai('a.svg', chu('<svg onload="alert(1)"/>')).ok).toBe(false);
  });

  it('từ chối tệp không có đuôi', () => {
    expect(kiemTraTepTai('README', chu('hi')).ma).toBe('duoi-khong-cho-phep');
  });

  it('thông báo liệt kê các đuôi được phép', () => {
    const kq = kiemTraTepTai('x.svg', chu('a'));
    for (const d of ['.py', '.png', '.wav']) expect(kq.lyDo).toContain(d);
  });

  it('mọi định dạng cho phép đều khai báo đủ thông tin', () => {
    for (const d of DINH_DANG_CHO_PHEP) {
      expect(d.duoi).toMatch(/^[a-z0-9]+$/);
      expect(d.mime).toContain('/');
    }
  });
});
