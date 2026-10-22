import { ERROR_MESSAGES, type ErrorCode } from './messages';

export interface AppErrorOptions {
  fields?: Record<string, string>;
}

/**
 * An expected, mapped failure. The response message always comes from the
 * centralized message table, never from user input or an underlying exception.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: ErrorCode, options: AppErrorOptions = {}) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = options.fields;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
