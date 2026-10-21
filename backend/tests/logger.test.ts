import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger, redactPath } from '../src/http/logger';
import { makeTestApp, type TestApp } from './helpers/test-app';

describe('logging and redaction', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = makeTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('redacts share tokens from paths', () => {
    expect(redactPath('/api/v1/shares/abc123?x=1')).toBe('/api/v1/shares/:token');
    expect(redactPath('/share/abc123')).toBe('/share/:token');
    expect(redactPath('/api/v1/health?x=1')).toBe('/api/v1/health');
  });

  it('writes request lines without bodies or query strings', async () => {
    await request(ctx.app).get('/api/v1/health?verbose=1');

    const record = ctx.records.find((entry) => entry.event === 'request');
    expect(record).toBeDefined();
    expect(record?.path).toBe('/api/v1/health');
    expect(record?.status).toBe(400);
    expect(record?.method).toBe('GET');
    expect(JSON.stringify(record)).not.toContain('verbose');
    expect(record).not.toHaveProperty('body');
  });

  it('never logs the raw body attached to a parser error', () => {
    const lines: string[] = [];
    const logger = createLogger({
      write: (line) => lines.push(line),
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    });

    const error = Object.assign(new Error('parse failed'), {
      body: 'super-secret-body',
    });
    logger.error('parse_error', { path: '/api/v1/boards' }, error);

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('super-secret-body');
    expect(lines[0]).toContain('hasAttachedBody');
    expect(lines[0]).toContain('"level":"error"');
  });
});
