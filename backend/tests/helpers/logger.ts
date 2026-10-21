import type { Logger } from '../../src/http/logger';

export interface LogRecord {
  level: 'info' | 'error';
  event: string;
  [key: string]: unknown;
}

export function createMemoryLogger(): { records: LogRecord[]; logger: Logger } {
  const records: LogRecord[] = [];

  return {
    records,
    logger: {
      info(event, fields): void {
        records.push({ ...(fields ?? {}), level: 'info', event });
      },
      error(event, fields, error): void {
        records.push({
          ...(fields ?? {}),
          level: 'error',
          event,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      },
    },
  };
}
