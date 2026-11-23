import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { registerUser } from '../helpers/auth.js';

const app = createApp();

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

function refreshCookie(res) {
  return res.headers['set-cookie']?.find((c) => c.startsWith('tm_refresh='));
}

describe('POST /auth/register', () => {
  it('creates an account, hashes the password and starts a session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Asha', email: 'Asha@Example.com', password: 'Secr3tpass' });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ name: 'Asha', email: 'asha@example.com' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.tokenType).toBe('Bearer');

    const cookie = refreshCookie(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/v1/auth');

    const stored = await prisma.user.findUnique({ where: { email: 'asha@example.com' } });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain('Secr3tpass');
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser(app, { email: 'dup@example.com' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Again', email: 'DUP@example.com', password: 'Passw0rd!' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates the body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const { user, password } = await registerUser(app);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email.toUpperCase(), password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const { user } = await registerUser(app);
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Wrongpass1' });
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Wrongpass1' });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });
});

describe('protected routes', () => {
  it('reject a missing, malformed or tampered token', async () => {
    const { token } = await registerUser(app);

    expect((await request(app).get('/api/v1/users/me')).status).toBe(401);
    const bad = await request(app).get('/api/v1/users/me').set('Authorization', 'Bearer abc.def');
    expect(bad.status).toBe(401);
    const tampered = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token.slice(0, -2)}xx`);
    expect(tampered.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token (cookie) and issues a new access token', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'R', email: 'r@example.com', password: 'Passw0rd!' });
    const cookie = refreshCookie(reg).split(';')[0];

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).not.toBe(reg.body.data.refreshToken);

    const me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('accepts the token in the body, and revokes the session when an old token is replayed', async () => {
    const { refreshToken, auth } = await registerUser(app);

    const first = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);

    // Replaying the rotated-out token looks like theft: the whole session ends.
    const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);

    const newer = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.body.data.refreshToken });
    expect(newer.status).toBe(401);
    expect((await request(app).get('/api/v1/users/me').set(auth)).status).toBe(401);
  });

  it('rejects garbage', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'nope' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('ends the session immediately, so the same access token stops working', async () => {
    const { auth, refreshToken } = await registerUser(app);

    const res = await request(app).post('/api/v1/auth/logout').set(auth);
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/tm_refresh=;/);

    expect((await request(app).get('/api/v1/users/me').set(auth)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(
      401,
    );
  });

  it('logout-all ends every session of the user', async () => {
    const { user, password, auth } = await registerUser(app);
    const other = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    const otherAuth = { Authorization: `Bearer ${other.body.data.accessToken}` };

    expect((await request(app).post('/api/v1/auth/logout-all').set(auth)).status).toBe(204);
    expect((await request(app).get('/api/v1/users/me').set(otherAuth)).status).toBe(401);
  });
});
