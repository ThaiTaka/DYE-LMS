/**
 * Archive packaging.
 *
 * The claim being tested is binary integrity. A single implicit `toString()`
 * anywhere on the store→zip→response path would mangle every sprite into
 * something that still opens as a zip and no longer opens as an image — the kind
 * of corruption nobody notices until a child's game is broken, so it gets a test
 * that compares bytes rather than lengths.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bamNoiDung, khoaLuuTru } from '@dye/core';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let thuMuc: string;

beforeAll(async () => {
  // Point storage at a scratch directory before the module reads the env var.
  thuMuc = await mkdtemp(join(tmpdir(), 'dye-zip-test-'));
  process.env['PROJECT_STORAGE_DIR'] = thuMuc;
});

afterAll(async () => {
  await rm(thuMuc, { recursive: true, force: true });
});

const { khoDuAn } = await import('./project-storage');
const { nenDuAn, tenTepAnToan } = await import('./project-zip');

/** A PNG whose bytes include everything a text round-trip would destroy. */
function anhGia(): Uint8Array {
  const dau = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const than: number[] = [];
  // Every byte value 0–255, twice. Includes NUL, 0xFF, and sequences that are
  // not valid UTF-8 — exactly what a string conversion would replace with U+FFFD.
  for (let lap = 0; lap < 2; lap += 1) {
    for (let i = 0; i < 256; i += 1) than.push(i);
  }
  return new Uint8Array([...dau, ...than]);
}

async function luu(data: Uint8Array): Promise<string> {
  const key = khoaLuuTru(bamNoiDung(data));
  await khoDuAn.ghi(key, data);
  return key;
}

// ═══════════════════════════════════════════════════════════════════════════

describe('Nén dự án', () => {
  it('giữ nguyên từng byte của tệp nhị phân', async () => {
    const anh = anhGia();
    const key = await luu(anh);

    const { duLieu, soTep } = await nenDuAn([{ path: 'assets/player.png', storageKey: key }]);
    expect(soTep).toBe(1);

    const zip = await JSZip.loadAsync(duLieu);
    const lai = await zip.file('assets/player.png')!.async('uint8array');

    // Byte-for-byte, not just the same length.
    expect(lai.length).toBe(anh.length);
    expect(Array.from(lai)).toEqual(Array.from(anh));
  });

  it('giữ nguyên hash sau khi nén và giải nén', async () => {
    const am = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      ...Array.from({ length: 500 }, (_, i) => (i * 37) % 256),
    ]);
    const key = await luu(am);

    const { duLieu } = await nenDuAn([{ path: 'am-thanh/no.wav', storageKey: key }]);
    const zip = await JSZip.loadAsync(duLieu);
    const lai = await zip.file('am-thanh/no.wav')!.async('uint8array');

    expect(bamNoiDung(lai)).toBe(bamNoiDung(am));
  });

  it('giữ nguyên tiếng Việt có dấu trong tệp văn bản', async () => {
    const code = new TextEncoder().encode('# Trò chơi của em\nprint("Xin chào 🎮")\n');
    const key = await luu(code);

    const { duLieu } = await nenDuAn([{ path: 'main.py', storageKey: key }]);
    const zip = await JSZip.loadAsync(duLieu);

    expect(await zip.file('main.py')!.async('string')).toBe(
      '# Trò chơi của em\nprint("Xin chào 🎮")\n',
    );
  });

  it('giữ đúng cấu trúc thư mục', async () => {
    const a = await luu(new TextEncoder().encode('import pygame\n'));
    const b = await luu(anhGia());

    const { duLieu, soTep } = await nenDuAn([
      { path: 'main.py', storageKey: a },
      { path: 'assets/player.png', storageKey: b },
    ]);

    expect(soTep).toBe(2);
    const zip = await JSZip.loadAsync(duLieu);
    expect(zip.file('main.py')).not.toBeNull();
    expect(zip.file('assets/player.png')).not.toBeNull();
  });

  it('nhiều tệp cùng nội dung vẫn ra đủ mục trong zip', async () => {
    const key = await luu(anhGia());

    const { duLieu, soTep } = await nenDuAn([
      { path: 'a.png', storageKey: key },
      { path: 'assets/b.png', storageKey: key },
    ]);

    // Blobs are deduplicated in storage; the archive must not be.
    expect(soTep).toBe(2);
    const zip = await JSZip.loadAsync(duLieu);
    expect(zip.file('a.png')).not.toBeNull();
    expect(zip.file('assets/b.png')).not.toBeNull();
  });

  it('KHÔNG tạo mục có đường dẫn thoát ra ngoài (zip slip)', async () => {
    const key = await luu(new TextEncoder().encode('x'));

    const { duLieu, soTep, thieu } = await nenDuAn([
      { path: '../../../etc/passwd', storageKey: key },
      { path: 'main.py', storageKey: key },
    ]);

    // A `../` entry is a traversal in whatever unpacks the archive, days later,
    // on someone else's machine.
    expect(soTep).toBe(1);
    expect(thieu).toContain('../../../etc/passwd');

    const zip = await JSZip.loadAsync(duLieu);
    for (const ten of Object.keys(zip.files)) {
      expect(ten).not.toContain('..');
      expect(ten.startsWith('/')).toBe(false);
    }
  });

  it('báo lại tệp thiếu thay vì im lặng bỏ qua', async () => {
    const { soTep, thieu } = await nenDuAn([
      { path: 'mat-tich.png', storageKey: khoaLuuTru('0'.repeat(64)) },
    ]);

    expect(soTep).toBe(0);
    // A teacher opening a silently incomplete archive would never know.
    expect(thieu).toEqual(['mat-tich.png']);
  });

  it('nén được dự án rỗng mà không nổ', async () => {
    const { duLieu, soTep } = await nenDuAn([]);
    expect(soTep).toBe(0);
    expect(duLieu.length).toBeGreaterThan(0);
    await expect(JSZip.loadAsync(duLieu)).resolves.toBeDefined();
  });
});

describe('tenTepAnToan', () => {
  it('bỏ dấu tiếng Việt để tên tệp mở được ở mọi hệ điều hành', () => {
    expect(tenTepAnToan('Trò chơi của em')).toBe('Tro-choi-cua-em');
    expect(tenTepAnToan('Đường đua')).toBe('Duong-dua');
  });

  it('bỏ ký tự nguy hiểm cho hệ thống tệp', () => {
    const ten = tenTepAnToan('../../etc/passwd');
    expect(ten).not.toContain('/');
    expect(ten).not.toContain('..');
  });

  it('tên rỗng vẫn ra tên dùng được', () => {
    expect(tenTepAnToan('***')).toBe('du-an');
    expect(tenTepAnToan('')).toBe('du-an');
  });

  it('cắt ngắn tên quá dài', () => {
    expect(tenTepAnToan('a'.repeat(300)).length).toBeLessThanOrEqual(80);
  });
});

describe('Kho lưu trữ theo nội dung', () => {
  it('ghi rồi đọc lại đúng byte', async () => {
    const data = anhGia();
    const key = await luu(data);

    const lai = await khoDuAn.doc(key);
    expect(Array.from(lai!)).toEqual(Array.from(data));
  });

  it('khoá không hợp lệ bị từ chối', async () => {
    // Keys come from a hash, so a malformed one means a bug or tampering.
    await expect(khoDuAn.ghi('../../thoat', new Uint8Array([1]))).rejects.toThrow();
    await expect(khoDuAn.ghi('khong-phai-hash', new Uint8Array([1]))).rejects.toThrow();
  });

  it('đọc khoá không tồn tại trả null thay vì ném lỗi', async () => {
    expect(await khoDuAn.doc(khoaLuuTru('a'.repeat(64)))).toBeNull();
  });

  it('ghi hai lần cùng nội dung là thao tác không đổi', async () => {
    const data = new TextEncoder().encode('cung mot noi dung');
    const k1 = await luu(data);
    const k2 = await luu(data);

    expect(k2).toBe(k1);
    expect(Array.from((await khoDuAn.doc(k1))!)).toEqual(Array.from(data));
  });
});
