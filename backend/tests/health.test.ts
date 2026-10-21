import fs from 'node:fs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from './helpers/test-app';

describe('GET /api/v1/health', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = makeTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('returns the exact contract and baseline headers', async () => {
    const response = await request(ctx.app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.body).toEqual({
      data: {
        status: 'ok',
        features: {
          priority: false,
          filters: false,
          ordering: false,
          sharing: false,
        },
      },
    });
  });

  it('rejects unknown query parameters', async () => {
    const response = await request(ctx.app).get('/api/v1/health?verbose=1');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 503 when the database file is not readable', async () => {
    ctx.db.close();
    fs.rmSync(ctx.config.databasePath);

    const response = await request(ctx.app).get('/api/v1/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '服务暂不可用，请稍后重试',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(ctx.config.databasePath);
  });
});
