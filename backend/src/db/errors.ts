export class DatabaseNotInitializedError extends Error {
  constructor(message = '数据库文件不存在，请先执行初始化（TASK-005 提供 npm run db:init）') {
    super(message);
    this.name = 'DatabaseNotInitializedError';
  }
}

const UNAVAILABLE_CODES = new Set([
  'SQLITE_BUSY',
  'SQLITE_LOCKED',
  'SQLITE_CANTOPEN',
  'SQLITE_READONLY',
  'SQLITE_IOERR',
  'SQLITE_CORRUPT',
  'SQLITE_NOTADB',
  'SQLITE_FULL',
]);

/** Database failures that should become 503 rather than 500. */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') {
    return false;
  }
  return (
    UNAVAILABLE_CODES.has(code) ||
    code.startsWith('SQLITE_BUSY') ||
    code.startsWith('SQLITE_LOCKED')
  );
}
