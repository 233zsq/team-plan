import express, { type RequestHandler } from 'express';
import { AppError } from '../errors';
import { assertJsonObject, assertSafeJson } from '../validation';

function hasRequestBody(req: Parameters<RequestHandler>[0]): boolean {
  const contentLength = req.headers['content-length'];
  if (contentLength !== undefined && Number(contentLength) > 0) {
    return true;
  }
  return req.headers['transfer-encoding'] !== undefined;
}

/**
 * 415 guard for write routes. It runs before parsing and only when the request
 * carries a body, so an empty POST/PUT/DELETE is not rejected here.
 */
export function requireJsonBody(): RequestHandler {
  return (req, _res, next) => {
    if (!hasRequestBody(req)) {
      next();
      return;
    }

    const contentEncoding = String(req.headers['content-encoding'] ?? 'identity')
      .trim()
      .toLowerCase();
    if (contentEncoding !== 'identity') {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE');
    }

    const contentType = String(req.headers['content-type'] ?? '')
      .trim()
      .toLowerCase();
    const [mediaType, ...parameters] = contentType.split(';').map((part) => part.trim());

    if (mediaType !== 'application/json') {
      throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE');
    }

    const charsetParameter = parameters.find((parameter) => parameter.startsWith('charset='));
    if (charsetParameter !== undefined) {
      const charset = charsetParameter.slice('charset='.length).replace(/"/g, '');
      if (charset !== 'utf-8' && charset !== 'utf8') {
        throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE');
      }
    }

    next();
  };
}

const jsonParser = express.json({ limit: '32kb', type: 'application/json' });

const validateJsonBody: RequestHandler = (req, _res, next) => {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }

  try {
    assertJsonObject(req.body);
    assertSafeJson(req.body);
  } catch (error) {
    next(error);
    return;
  }

  next();
};

/** Media type guard, 32 KiB parser and JSON object validation, in that order. */
export function jsonBody(): RequestHandler[] {
  return [requireJsonBody(), jsonParser, validateJsonBody];
}

/**
 * Single mount point for write routes. New write routes must use this helper so
 * the 415/413/400 precedence cannot drift.
 */
export function writeRoute(handler: RequestHandler): RequestHandler[] {
  return [...jsonBody(), handler];
}
