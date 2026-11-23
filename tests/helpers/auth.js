import request from 'supertest';

let counter = 0;

/** Registers a fresh user and returns { user, token, refreshToken, auth } for use in tests. */
export async function registerUser(app, overrides = {}) {
  counter += 1;
  const body = {
    name: `User ${counter}`,
    email: `user${counter}-${Date.now()}@example.com`,
    password: 'Passw0rd!',
    ...overrides,
  };
  const res = await request(app).post('/api/v1/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  const { user, accessToken, refreshToken } = res.body.data;
  return {
    user,
    token: accessToken,
    refreshToken,
    password: body.password,
    auth: { Authorization: `Bearer ${accessToken}` },
  };
}
