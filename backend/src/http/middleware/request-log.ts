import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { redactPath, type Logger } from '../logger';

/**
 * One diagnostic line per request: method, redacted path, status and duration.
 * Request bodies, query strings and credentials are never logged.
 */
export function requestLog(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const requestId = randomUUID();
    res.locals.requestId = requestId;

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info('request', {
        requestId,
        method: req.method,
        path: redactPath(req.originalUrl),
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      });
    });

    next();
  };
}
