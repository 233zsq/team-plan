import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from './helpers/test-app';

describe('error contract', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = makeTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('rejects unknown JSON keys with 400', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/keys')
      .send({ name: 'ok', extra: true });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: 'BAD_REQUEST', message: '请求格式不正确' },
    });
  });

  it('rejects dangerous prototype keys with 400 and does not pollute Object.prototype', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"polluted":true}}');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('keeps field errors for a validation failure', async () => {
    const response = await request(ctx.app).get('/api/v1/__test/validation');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: '请检查输入内容',
        fields: { title: '标题不能为空' },
      },
    });
  });

  it('sanitizes unexpected errors and keeps details only in the log', async () => {
    const response = await request(ctx.app).get('/api/v1/__test/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
    });

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('SELECT');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('db.sqlite');
    expect(serialized).not.toContain('stack');

    const errorRecord = ctx.records.find((record) => record.event === 'request_error');
    expect(errorRecord).toBeDefined();
    expect(String(errorRecord?.errorMessage)).toContain('SELECT');
  });

  it('rejects an unknown Host with 403', async () => {
    const response = await request(ctx.app)
      .get('/api/v1/health')
      .set('Host', 'evil.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.data).toBeUndefined();
  });

  it('returns JSON 404 for an unknown method on a known path', async () => {
    const response = await request(ctx.app).post('/api/v1/health');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
