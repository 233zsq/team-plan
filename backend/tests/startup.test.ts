import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase, probeReadable } from '../src/db/connection';
import { DatabaseNotInitializedError } from '../src/db/errors';
import { normalizeHostHeader } from '../src/http/middleware/host-guard';
import { createTempDatabase } from './helpers/temp-db';

describe('startup checks', () => {
  it('refuses to open a missing database file instead of creating one', () => {
    const temp = createTempDatabase();
    const missing = path.join(temp.dir, 'missing.sqlite');

    try {
      expect(() => openDatabase(missing)).toThrow(DatabaseNotInitializedError);
      expect(fs.existsSync(missing)).toBe(false);
      expect(() => probeReadable(missing)).toThrow();
    } finally {
      temp.cleanup();
    }
  });

  it('applies foreign keys and busy timeout, and closes idempotently', () => {
    const temp = createTempDatabase();
    const db = openDatabase(temp.path);

    try {
      expect(db.raw.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(db.raw.pragma('busy_timeout', { simple: true })).toBe(5000);
      expect(() => db.probe()).not.toThrow();
      db.close();
      db.close();
    } finally {
      temp.cleanup();
    }
  });

  it('normalizes Host headers with ports and IPv6 literals', () => {
    expect(normalizeHostHeader('127.0.0.1:3000')).toBe('127.0.0.1');
    expect(normalizeHostHeader('[::1]:3000')).toBe('[::1]');
    expect(normalizeHostHeader('EXAMPLE.com')).toBe('example.com');
    expect(normalizeHostHeader(undefined)).toBeNull();
    expect(normalizeHostHeader('')).toBeNull();
  });
});
