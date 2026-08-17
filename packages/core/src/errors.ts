/**
 * Auth and authorization errors.
 *
 * Deliberately coarse on the outside: `Forbidden` never says *why* access was
 * denied, and `Unauthorized` never distinguishes "no such user" from "wrong
 * password". Detailed reasons go to the audit log, not to the client — a precise
 * error message is a user-enumeration oracle.
 */

export class UnauthorizedError extends Error {
  readonly status = 401;

  /** Internal detail for the audit log. Never sent to the client. */
  readonly reason: string;

  constructor(reason: string) {
    super('Chưa đăng nhập hoặc phiên đã hết hạn.');
    this.name = 'UnauthorizedError';
    this.reason = reason;
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  /** Internal detail for the audit log. Never sent to the client. */
  readonly reason: string;

  constructor(reason: string) {
    super('Bạn không có quyền thực hiện thao tác này.');
    this.name = 'ForbiddenError';
    this.reason = reason;
  }
}

export class AccountDisabledError extends Error {
  readonly status = 403;

  constructor() {
    super('Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ giáo viên.');
    this.name = 'AccountDisabledError';
  }
}

export class RateLimitedError extends Error {
  readonly status = 429;
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('Bạn đã thử quá nhiều lần. Vui lòng chờ một lát rồi thử lại.');
    this.name = 'RateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
