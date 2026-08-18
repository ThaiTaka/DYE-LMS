import 'server-only';

/**
 * Packaging a project version as a `.zip` a teacher can download and open.
 *
 * ── Binary integrity ─────────────────────────────────────────────────────────
 * The archive carries sprites and sound files. Everything here stays in
 * `Uint8Array`/`Buffer` from the store to the response — no string round-trip,
 * no encoding parameter, no text mode. A single implicit `toString()` anywhere
 * on this path would silently mangle every PNG in the archive into something
 * that still opens as a zip and no longer opens as an image, which is the kind
 * of corruption nobody notices until a child's game is broken.
 *
 * ── Why paths are re-checked here ────────────────────────────────────────────
 * `ProjectFile.path` was validated on the way in, so it is already safe. It is
 * checked again on the way out because a zip entry name is interpreted by
 * whatever unpacks it — and "zip slip" is a path traversal that happens on
 * someone else's computer, days later, in a program we do not control.
 */
import { kiemTraDuongDan } from '@dye/core';
import JSZip from 'jszip';

import { khoDuAn } from './project-storage';

export interface TepDeNen {
  path: string;
  storageKey: string;
}

export interface KetQuaNen {
  duLieu: Uint8Array;
  soTep: number;
  /** Files skipped because their bytes were missing from the store. */
  thieu: string[];
}

/**
 * Build the archive's own filename from a student-chosen project title.
 *
 * The result lands in a `Content-Disposition` header, so it must survive being
 * quoted there and being saved by whatever operating system is on the other end.
 * Diacritics are folded rather than dropped, because "Trò chơi" becoming
 * "Tro-choi" is a recognisable filename and "----" is not.
 *
 * Runs of dots collapse and leading dots go: a name is never `..`, never
 * hidden, and never carries anything a shell or an unarchiver might read as a
 * path element.
 */
export function tenTepAnToan(raw: string): string {
  const sach = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    // Only these characters survive, so quotes and separators cannot appear.
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '')
    .replace(/[.-]+$/, '');

  return sach.slice(0, 80) || 'du-an';
}

export async function nenDuAn(tep: TepDeNen[]): Promise<KetQuaNen> {
  const zip = new JSZip();
  const thieu: string[] = [];
  let soTep = 0;

  for (const t of tep) {
    // Zip slip: an entry named `../../x` is a traversal in the extractor, not
    // here. Refuse to emit one at all.
    const kiem = kiemTraDuongDan(t.path);
    if (!kiem.ok) {
      thieu.push(t.path);
      continue;
    }

    const duLieu = await khoDuAn.doc(t.storageKey);
    if (!duLieu) {
      // Recorded rather than swallowed: a missing blob is a real fault, and a
      // teacher opening a silently incomplete archive would never know.
      thieu.push(t.path);
      continue;
    }

    // `binary: false` with a Uint8Array keeps the bytes untouched. No string
    // conversion happens on this path.
    zip.file(kiem.duongDan, duLieu);
    soTep += 1;
  }

  const duLieu = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { duLieu, soTep, thieu };
}
