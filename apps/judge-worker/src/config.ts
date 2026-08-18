/**
 * Sandbox limits.
 *
 * These are ceilings the worker enforces regardless of what a problem row asks
 * for. A problem is authored data; if a bad value ever reaches the database — a
 * typo, a bad import, a compromised teacher account — it must not be able to
 * hand a container the whole machine.
 */
function so(ten: string, macDinh: number): number {
  const v = Number(process.env[ten]);
  return Number.isFinite(v) && v > 0 ? v : macDinh;
}

export const GIOI_HAN = {
  /** Default when a problem does not specify. Matches the Phase 8 brief. */
  BO_NHO_MAC_DINH_MB: 128,
  /** Hard ceiling. A problem asking for more is clamped, not honoured. */
  BO_NHO_TOI_DA_MB: so('JUDGE_MAX_MEMORY_MB', 256),
  /** Below this, CPython cannot start and every verdict would be a false MLE. */
  BO_NHO_TOI_THIEU_MB: 64,

  CPU: 0.5,
  PIDS: 50,
  TMPFS_MB: 10,

  /** Grace on top of the problem's limit before the host kills the container. */
  AN_HAN_MS: so('JUDGE_KILL_GRACE_MS', 1000),
  /** If `docker kill` is itself wedged, stop waiting on the client after this. */
  CHO_SAU_KHI_GIET_MS: 3000,

  DAU_RA_BYTE: so('JUDGE_OUTPUT_LIMIT_BYTES', 262_144),
  /**
   * Cap for PERFORMANCE runs.
   *
   * A sorting exercise at N = 100 000 prints roughly 800 KB, which is the
   * exercise working correctly. Still bounded — a genuine runaway printer is
   * caught by the time limit long before it reaches this.
   */
  DAU_RA_HIEU_NANG_BYTE: so('JUDGE_PERF_OUTPUT_LIMIT_BYTES', 8 * 1024 * 1024),
  LOI_BYTE: 16_384,

  /** Ceiling on any single problem's time limit, whatever the row says. */
  THOI_GIAN_TOI_DA_MS: so('JUDGE_MAX_TIME_MS', 10_000),
} as const;

export const CAU_HINH = {
  redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6389',
  /** How many submissions may be judged at once. Each holds a container. */
  soViecSongSong: so('JUDGE_CONCURRENCY', 4),
  /** Periodic sweep for submissions that never made it onto the queue. */
  quetOrphanMs: so('JUDGE_SWEEP_MS', 60_000),
} as const;
