/**
 * Seeded input generators for the Big-O performance challenge.
 *
 * The names here are not invented: they are the exact `generator` strings the
 * Phase 2 seed wrote into `PerformanceScenario.generator`. If a scenario names
 * a generator that does not exist, the run is refused rather than silently
 * graded against nothing.
 *
 * Everything is deterministic from `(seed, n)`. Two students solving the same
 * scenario must receive byte-identical input, or a timing comparison between
 * them means nothing — and the whole point of this challenge is that the
 * difference between linear and binary search shows up as a shape on a graph.
 */

/** Mulberry32 — small, fast, and identical across platforms and runs. */
function nguonNgauNhien(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function soNguyen(rnd: () => number, canDuoi: number, canTren: number): number {
  return canDuoi + Math.floor(rnd() * (canTren - canDuoi + 1));
}

export interface ThamSoSinh {
  n: number;
  seed: number;
}

/**
 * A generator returns the exact stdin the student's program will read.
 *
 * The shape is documented in each problem statement, so the format below is a
 * contract with the seeded curriculum, not an implementation detail.
 */
export type BoSinh = (t: ThamSoSinh) => string;

const SO_TRUY_VAN = 1000;

export const BO_SINH: Record<string, BoSinh> = {
  /** n, then n random integers. */
  mang_ngau_nhien: ({ n, seed }) => {
    const rnd = nguonNgauNhien(seed);
    const a = Array.from({ length: n }, () => soNguyen(rnd, 1, 1_000_000));
    return `${n}\n${a.join(' ')}\n`;
  },

  /** n, then n integers already in ascending order. */
  mang_da_sap_xep: ({ n, seed }) => {
    const rnd = nguonNgauNhien(seed);
    let x = 0;
    const a = Array.from({ length: n }, () => {
      x += soNguyen(rnd, 1, 9);
      return x;
    });
    return `${n}\n${a.join(' ')}\n`;
  },

  /**
   * Sorted, then a few pairs swapped.
   *
   * This is the scenario that makes insertion sort look good — O(n) on nearly
   * sorted data — which is the entire teaching point of that session.
   */
  mang_gan_nhu_sap_xep: ({ n, seed }) => {
    const rnd = nguonNgauNhien(seed);
    let x = 0;
    const a = Array.from({ length: n }, () => {
      x += soNguyen(rnd, 1, 9);
      return x;
    });

    const soHoanDoi = Math.max(1, Math.floor(n * 0.02));
    for (let i = 0; i < soHoanDoi; i += 1) {
      const p = soNguyen(rnd, 0, n - 2);
      const tam = a[p]!;
      a[p] = a[p + 1]!;
      a[p + 1] = tam;
    }
    return `${n}\n${a.join(' ')}\n`;
  },

  /** n, sorted array, then Q queries — the binary/jump search scenarios. */
  mang_sap_xep_va_truy_van: ({ n, seed }) => {
    const rnd = nguonNgauNhien(seed);
    let x = 0;
    const a = Array.from({ length: n }, () => {
      x += soNguyen(rnd, 1, 9);
      return x;
    });

    const q = Math.min(SO_TRUY_VAN, n);
    const truyVan = Array.from({ length: q }, () =>
      // Half the queries hit, half miss: a solution that only handles found
      // values must not score full marks.
      rnd() < 0.5 ? a[soNguyen(rnd, 0, n - 1)]! : soNguyen(rnd, 1, x + 10),
    );

    return `${n}\n${a.join(' ')}\n${q}\n${truyVan.join(' ')}\n`;
  },

  /** n, random array, then Q range-sum queries (prefix-sum scenario). */
  mang_ngau_nhien_va_truy_van_tong: ({ n, seed }) => {
    const rnd = nguonNgauNhien(seed);
    const a = Array.from({ length: n }, () => soNguyen(rnd, 1, 1000));

    const q = Math.min(SO_TRUY_VAN, n);
    const truyVan = Array.from({ length: q }, () => {
      const l = soNguyen(rnd, 1, n);
      const r = soNguyen(rnd, l, n);
      return `${l} ${r}`;
    });

    return `${n}\n${a.join(' ')}\n${q}\n${truyVan.join('\n')}\n`;
  },
};

export function coBoSinh(ten: string): boolean {
  return Object.hasOwn(BO_SINH, ten);
}

/** Generate input, or refuse. Never returns empty input for an unknown name. */
export function sinhDauVao(ten: string, thamSo: ThamSoSinh): string {
  const bo = BO_SINH[ten];
  if (!bo) {
    throw new Error(`khong co bo sinh du lieu ten "${ten}"`);
  }
  return bo(thamSo);
}
