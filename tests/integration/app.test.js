import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/health', () => {
  it('reports the API and database as up', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'up' });
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
  });

  it('returns a request ID header, and reuses a safe one sent by the client', async () => {
    const generated = await request(app).get('/api/v1/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await request(app).get('/api/v1/health').set('X-Request-Id', 'client-req-123');
    expect(echoed.headers['x-request-id']).toBe('client-req-123');

    const unsafe = await request(app)
      .get('/api/v1/health')
      .set('X-Request-Id', 'bad id; with <script>');
    expect(unsafe.headers['x-request-id']).not.toContain('bad id');
  });

  it('sets security headers (helmet)', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('error handling', () => {
  it('returns the standard 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route GET /api/v1/does-not-exist not found' },
    });
  });

  it('returns 400 INVALID_JSON for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 413 for a body over the size limit', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(150 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('CORS', () => {
  it('allows a configured origin', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects an unknown origin with 403', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CORS_NOT_ALLOWED');
  });
});

describe('API docs', () => {
  it('serves the OpenAPI spec', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/health']).toBeDefined();
  });

  it('serves the Swagger UI', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
