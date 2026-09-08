/**
 * The expansion pack, assembled per course.
 *
 * Each entry is applied by `apDungBoSung` in ../index.ts. Split into numbered
 * files by session range purely so no single file becomes unreviewable; the
 * shape is one flat `lessonSlug -> blocks` map per course.
 */
import { boSungMicrobit1 } from './microbit-1.ts';
import { boSungMicrobit2 } from './microbit-2.ts';
import { boSungNangCao1 } from './nang-cao-1.ts';
import { boSungNangCao2 } from './nang-cao-2.ts';
import { boSungNangCaoOOP } from './nang-cao-oop.ts';
import { boSungPygame1 } from './pygame-1.ts';
import { boSungPygame2 } from './pygame-2.ts';
import { boSungPythonCoBan1 } from './python-co-ban-1.ts';
import { boSungPythonCoBan2 } from './python-co-ban-2.ts';
import { boSungPythonCoBan3 } from './python-co-ban-3.ts';

import type { BoSungKhoaHoc } from './ap-dung.ts';

export const boSungPythonCoBan: BoSungKhoaHoc = {
  ...boSungPythonCoBan1,
  ...boSungPythonCoBan2,
  ...boSungPythonCoBan3,
};

export const boSungPygame: BoSungKhoaHoc = {
  ...boSungPygame1,
  ...boSungPygame2,
};

export const boSungPythonNangCao: BoSungKhoaHoc = {
  ...boSungNangCaoOOP,
  ...boSungNangCao1,
  ...boSungNangCao2,
};

export const boSungMicrobit: BoSungKhoaHoc = {
  ...boSungMicrobit1,
  ...boSungMicrobit2,
};
