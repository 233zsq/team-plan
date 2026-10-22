import type { RequestHandler } from 'express';
import { AppError } from '../errors';

/**
 * Strip the optional port and lowercase the Host header. IPv6 literals keep
 * their brackets, so `[::1]:3000` becomes `[::1]`.
 */
export function normalizeHostHeader(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const host = value.trim().toLowerCase();
  if (host === '') {
    return null;
  }

  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end === -1 ? null : host.slice(0, end + 1);
  }

  const colon = host.indexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}

/** Reject requests whose Host is not in the configured allowlist (DNS rebinding). */
export function hostGuard(allowedHosts: readonly string[]): RequestHandler {
  const allowed = new Set(allowedHosts.map((host) => host.toLowerCase()));

  return (req, _res, next) => {
    const host = normalizeHostHeader(req.headers.host);
    if (host === null || !allowed.has(host)) {
      throw new AppError(403, 'FORBIDDEN');
    }
    next();
  };
}
