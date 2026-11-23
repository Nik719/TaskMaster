import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { registerUser } from '../helpers/auth.js';

const app = createApp();

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('GET /users/me', () => {
  it('returns the profile without sensitive fields', async () => {
    const { user, auth } = await registerUser(app);
    const res = await request(app).get('/api/v1/users/me').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: user.id, email: user.email, bio: null });
    expect(res.body.data.passwordHash).toBeUndefined();
  });
});

describe('PATCH /users/me', () => {
  it('updates allowed fields and ignores the rest', async () => {
    const { auth, user } = await registerUser(app);
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(auth)
      .send({ name: 'New Name', bio: 'Backend dev', email: 'hijack@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'New Name',
      bio: 'Backend dev',
      email: user.email,
    });
  });

  it('rejects an empty update and a bad avatar URL', async () => {
    const { auth } = await registerUser(app);
    expect((await request(app).patch('/api/v1/users/me').set(auth).send({})).status).toBe(400);
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set(auth)
      .send({ avatarUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /users/me/password', () => {
  it('changes the password and signs out other devices', async () => {
    const { user, password, auth } = await registerUser(app);
    const other = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    const otherAuth = { Authorization: `Bearer ${other.body.data.accessToken}` };

    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set(auth)
      .send({ currentPassword: password, newPassword: 'Brandn3wpass' });
    expect(res.status).toBe(204);

    expect((await request(app).get('/api/v1/users/me').set(auth)).status).toBe(200);
    expect((await request(app).get('/api/v1/users/me').set(otherAuth)).status).toBe(401);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Brandn3wpass' });
    expect(login.status).toBe(200);
  });

  it('rejects a wrong current password', async () => {
    const { auth } = await registerUser(app);
    const res = await request(app)
      .patch('/api/v1/users/me/password')
      .set(auth)
      .send({ currentPassword: 'Wrongpass1', newPassword: 'Brandn3wpass' });
    expect(res.status).toBe(400);
  });
});
