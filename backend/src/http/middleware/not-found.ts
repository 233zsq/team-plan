import type { RequestHandler } from 'express';
import { ERROR_MESSAGES } from '../messages';

/**
 * Catch-all for unknown `/api` paths and methods. If a body is present it is
 * left unread, so close the connection instead of breaking keep-alive reuse.
 */
export function apiNotFound(): RequestHandler {
  return (req, res) => {
    const contentLength = req.headers['content-length'];
    const hasBody =
      (contentLength !== undefined && Number(contentLength) > 0) ||
      req.headers['transfer-encoding'] !== undefined;

    if (hasBody) {
      res.setHeader('Connection', 'close');
    }

    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: ERROR_MESSAGES.NOT_FOUND,
      },
    });
  };
}
