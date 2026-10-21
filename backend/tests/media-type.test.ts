import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from './helpers/test-app';

describe('write request media type', () => {
  let ctx: TestApp;

  beforeEach(() => {
    ctx = makeTestApp();
  });

  afterEach(() => {
    ctx.cleanup();
  });

  it('rejects a text/plain body with 415', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'text/plain')
      .send('hello');

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a non UTF-8 charset with 415', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{}');

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects unsupported Content-Encoding with 415', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send('{}');

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('allows an empty body without 415', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
  });

  it('maps malformed JSON to 400', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json')
      .send('{');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a top-level array with 400', async () => {
    const response = await request(ctx.app)
      .post('/api/v1/__test/echo')
      .set('Content-Type', 'application/json')
      .send('[]');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });
});
