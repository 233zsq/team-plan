import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from './helpers/test-app';

function bodyOfSize(size: number): string {
  const overhead = Buffer.byteLength(JSON.stringify({ payload: '' }));
  return JSON.stringify({ payload: 'a'.repeat(size - overhead) });
}

describe('32 KiB request body boundary', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = makeTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('accepts exactly 32768 bytes', async () => {
    const body = bodyOfSize(32_768);
    expect(Buffer.byteLength(body)).toBe(32_768);

    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { ok: true } });
  });

  it('rejects 32769 bytes with 413', async () => {
    const body = bodyOfSize(32_769);
    expect(Buffer.byteLength(body)).toBe(32_769);

    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(JSON.stringify(response.body)).not.toContain('a'.repeat(64));
  });
});
