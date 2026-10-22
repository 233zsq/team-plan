import type { RequestHandler } from 'express';

/**
 * Baseline headers for API responses. The SPA and share page get their own
 * policy later; `frame-ancestors` and `nosniff` apply everywhere.
 */
export function securityHeaders(): RequestHandler {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'none'");

    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      );
    }

    next();
  };
}
