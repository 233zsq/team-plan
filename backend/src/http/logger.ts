export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>, error?: unknown): void;
}

export interface LoggerOptions {
  write?: (line: string) => void;
  now?: () => Date;
}

/** Remove tokens from paths before they reach any log sink. */
export function redactPath(rawUrl: string): string {
  const pathOnly = (rawUrl.split('?')[0] ?? '/').trim() || '/';
  return pathOnly
    .replace(/^\/api\/v1\/shares\/[^/]+/, '/api/v1/shares/:token')
    .replace(/^\/share\/[^/]+/, '/share/:token');
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const write = options.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const now = options.now ?? (() => new Date());

  const emit = (
    level: 'info' | 'error',
    event: string,
    fields?: Record<string, unknown>,
    error?: unknown,
  ): void => {
    const record: Record<string, unknown> = {
      ...(fields ?? {}),
      time: now().toISOString(),
      level,
      event,
    };

    if (error !== undefined) {
      record.errorName = error instanceof Error ? error.name : typeof error;
      record.errorMessage = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && typeof error.stack === 'string') {
        record.stack = error.stack;
      }
      // body-parser attaches the raw request body to its errors; never log it.
      const attachedBody = (error as { body?: unknown }).body;
      if (attachedBody !== undefined) {
        record.hasAttachedBody = true;
      }
    }

    write(JSON.stringify(record));
  };

  return {
    info: (event, fields) => emit('info', event, fields),
    error: (event, fields, error) => emit('error', event, fields, error),
  };
}
