import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from './helpers/test-app';

describe('unknown API paths', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = makeTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('returns JSON 404 for an unknown path', async () => {
    const response = await request(ctx.app).get('/api/v1/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: '资源不存在' },
    });
  });

  it('returns 404 and closes the connection when a body is present', async () => {
    const body = JSON.stringify({ payload: 'a'.repeat(33 * 1024) });

    const response = await request(ctx.app)
      .post('/api/v1/unknown')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(response.status).toBe(404);
    expect(response.headers.connection).toBe('close');
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for the bare /api prefix', async () => {
    const response = await request(ctx.app).get('/api');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('ignores unknown query keys on an unknown path', async () => {
    const response = await request(ctx.app).get('/api/v1/unknown?x=1');

    expect(response.status).toBe(404);
  });
});
