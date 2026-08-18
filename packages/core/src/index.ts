/**
 * @dye/core — domain logic shared by the web app and the judge worker.
 *
 * Phase 3 ships the auth and authorization layer. Phase 4 adds the curriculum
 * engine (gating, tier routing, progress) to the same package.
 *
 * Nothing here imports Next.js. Everything takes a `PrismaClient` as an
 * argument, which is what makes it testable against a real database without a
 * web server in the loop.
 */

export {
  AccountDisabledError,
  ForbiddenError,
  RateLimitedError,
  UnauthorizedError,
} from './errors';

export {
  burnVerificationTime,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  PASSWORD_PARAMS,
  verifyPassword,
} from './password';

export {
  createSession,
  deactivateUser,
  generateSessionToken,
  purgeExpiredSessions,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  safeDigestEqual,
  SESSION_TTL_DAYS,
  validateSession,
  type Actor,
  type IssuedSession,
  type SessionContext,
} from './session';

export {
  AUDIT,
  changePassword,
  DEFAULT_LOGIN_RATE_LIMIT,
  login,
  logout,
  resetPasswordByStaff,
  revokeAllForUser,
  type LoginResult,
  type RateLimitPolicy,
} from './authenticate';

export {
  authorize,
  can,
  isEnrolledIn,
  ownsClass,
  requireActor,
  teachesStudent,
  visibleStudentIds,
  type AuthzRequest,
} from './authz';

export {
  ACCOUNT_AUDIT,
  anhHuongXoaTaiKhoan,
  chuyenGiaoHoSoGiangDay,
  khoiPhucNhanVien,
  nguoiCoTheNhanBanGiao,
  voHieuHoaNhanVien,
  xoaTaiKhoanNhanVien,
  type AnhHuongXoaTaiKhoan,
  type KetQuaChuyenGiao,
  type KetQuaXoaTaiKhoan,
  type RangBuocXoa,
} from './accounts';

export { bocMarkdown, rutGon, tenBuoi } from './text';

// ── Phase 7: code drafts, history, submission ────────────────────────────────
export {
  bamMa,
  docNhap,
  GIOI_HAN_KY_TU,
  KHOANG_CACH_BAN_LUU_MS,
  khoiPhucBanLuu,
  lichSuMa,
  lichSuNopBai,
  luuNhap,
  moKhoiCode,
  nopBai,
  SO_BAN_LUU_TOI_DA,
  xemBanLuu,
  type BaiDaNop,
  type BanLuu,
  type KetQuaLuuNhap,
  type KetQuaNopBai,
  type KhoiCode,
} from './code';

// ── Phase 4: curriculum engine ───────────────────────────────────────────────
export * from './curriculum/index';
