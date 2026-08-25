/**
 * Types for the shared root-`.env` loader.
 *
 * The implementation is plain ESM JavaScript rather than TypeScript because it
 * has to be runnable by a bare `node` — `npm run db:migrate` and the repo's
 * other wrapper scripts spawn the Prisma CLI without tsx in the loop, so a `.ts`
 * implementation could not be the same file the TypeScript entry points import.
 * This declaration is what lets both worlds share one copy.
 */

/** Absolute path to the monorepo root. */
export declare const GOC_KHO: string;

/** A value the loader had to repair on the way in. */
export interface SuaGiaTri {
  khoa: string;
  /** Which env file it came from. */
  tep: string;
  /** What kind of damage was repaired. */
  kieu: 'markdown';
  /** The value actually placed into process.env. */
  sau: string;
}

export interface KetQuaNapEnv {
  /** Env files actually found and read, in precedence order. */
  tepDaDoc: string[];
  /** Variables this call set. Excludes any that were already defined. */
  bienDaDat: string[];
  /** Repairs made while loading. Reported by `npm run doctor`. */
  daSua: SuaGiaTri[];
  soBien: number;
}

/**
 * Load `<root>/.env.production` then `<root>/.env` into `process.env`.
 *
 * Never overwrites an existing value, so it is safe to call more than once and a
 * real deployment variable always beats a file on disk.
 */
export declare function napEnv(goc?: string): KetQuaNapEnv;

/**
 * Exit with an operator-readable message when any of `ten` is missing.
 *
 * Pass the result of `napEnv()` so the message can report which files were read.
 */
export declare function doiBienMoiTruong(
  ten: readonly string[],
  ketQua?: { tepDaDoc: string[] },
): void;
