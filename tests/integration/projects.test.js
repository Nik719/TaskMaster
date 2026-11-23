import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { registerUser } from '../helpers/auth.js';

const app = createApp();
const api = '/api/v1';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function createProject(auth, body = { name: 'Apollo' }) {
  const res = await request(app).post(`${api}/projects`).set(auth).send(body);
  expect(res.status).toBe(201);
  return res.body.data;
}

/** Invites `invitee` to the project and has them accept. */
async function addMember(ownerAuth, projectId, invitee, role = 'MEMBER') {
  const inv = await request(app)
    .post(`${api}/projects/${projectId}/invitations`)
    .set(ownerAuth)
    .send({ email: invitee.user.email, role });
  expect(inv.status).toBe(201);
  const accept = await request(app)
    .post(`${api}/invitations/${inv.body.data.id}/accept`)
    .set(invitee.auth);
  expect(accept.status).toBe(200);
}

describe('projects CRUD', () => {
  it('creates a project with the creator as owner', async () => {
    const owner = await registerUser(app);
    const project = await createProject(owner.auth, { name: '  Apollo ', description: 'Launch' });

    expect(project).toMatchObject({
      name: 'Apollo',
      description: 'Launch',
      myRole: 'OWNER',
      memberCount: 1,
      owner: { id: owner.user.id },
    });
  });

  it('lists only my projects, with pagination and search', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await createProject(a.auth, { name: 'Alpha' });
    await createProject(a.auth, { name: 'Beta' });
    await createProject(b.auth, { name: 'Not mine' });

    const res = await request(app).get(`${api}/projects?limit=1`).set(a.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });

    const search = await request(app).get(`${api}/projects?q=alp`).set(a.auth);
    expect(search.body.data.map((p) => p.name)).toEqual(['Alpha']);
  });

  it('hides projects from non-members with 404', async () => {
    const owner = await registerUser(app);
    const stranger = await registerUser(app);
    const project = await createProject(owner.auth);

    const res = await request(app).get(`${api}/projects/${project.id}`).set(stranger.auth);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed ID with 400', async () => {
    const owner = await registerUser(app);
    const res = await request(app).get(`${api}/projects/not-a-uuid`).set(owner.auth);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ location: 'params', path: 'projectId' });
  });

  it('lets owners/admins update, but not members; only the owner deletes', async () => {
    const owner = await registerUser(app);
    const admin = await registerUser(app);
    const member = await registerUser(app);
    const project = await createProject(owner.auth);
    await addMember(owner.auth, project.id, admin, 'ADMIN');
    await addMember(owner.auth, project.id, member);

    const url = `${api}/projects/${project.id}`;
    expect((await request(app).patch(url).set(member.auth).send({ name: 'X' })).status).toBe(403);
    const updated = await request(app).patch(url).set(admin.auth).send({ name: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Renamed');

    expect((await request(app).delete(url).set(admin.auth)).status).toBe(403);
    expect((await request(app).delete(url).set(owner.auth)).status).toBe(204);
    expect((await request(app).get(url).set(owner.auth)).status).toBe(404);
  });
});

describe('invitations', () => {
  it('invite → accept adds the user as a member', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const project = await createProject(owner.auth);

    const inv = await request(app)
      .post(`${api}/projects/${project.id}/invitations`)
      .set(owner.auth)
      .send({ email: invitee.user.email.toUpperCase() });
    expect(inv.status).toBe(201);
    expect(inv.body.data).toMatchObject({ status: 'PENDING', role: 'MEMBER' });

    const mine = await request(app).get(`${api}/invitations`).set(invitee.auth);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].project.name).toBe('Apollo');

    const accept = await request(app)
      .post(`${api}/invitations/${inv.body.data.id}/accept`)
      .set(invitee.auth);
    expect(accept.status).toBe(200);
    expect(accept.body.data.role).toBe('MEMBER');

    const members = await request(app)
      .get(`${api}/projects/${project.id}/members`)
      .set(invitee.auth);
    expect(members.body.data.map((m) => m.role)).toEqual(['OWNER', 'MEMBER']);

    // An accepted invitation can't be used again.
    const again = await request(app)
      .post(`${api}/invitations/${inv.body.data.id}/accept`)
      .set(invitee.auth);
    expect(again.status).toBe(404);
  });

  it('waits for people who have not signed up yet', async () => {
    const owner = await registerUser(app);
    const project = await createProject(owner.auth);
    await request(app)
      .post(`${api}/projects/${project.id}/invitations`)
      .set(owner.auth)
      .send({ email: 'later@example.com' });

    const newcomer = await registerUser(app, { email: 'later@example.com' });
    const mine = await request(app).get(`${api}/invitations`).set(newcomer.auth);
    expect(mine.body.data).toHaveLength(1);
  });

  it('declined invitations do not add the user', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const project = await createProject(owner.auth);
    const inv = await request(app)
      .post(`${api}/projects/${project.id}/invitations`)
      .set(owner.auth)
      .send({ email: invitee.user.email });

    const res = await request(app)
      .post(`${api}/invitations/${inv.body.data.id}/decline`)
      .set(invitee.auth);
    expect(res.status).toBe(204);
    expect((await request(app).get(`${api}/projects/${project.id}`).set(invitee.auth)).status).toBe(
      404,
    );
  });

  it("someone else can't accept my invitation", async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const thief = await registerUser(app);
    const project = await createProject(owner.auth);
    const inv = await request(app)
      .post(`${api}/projects/${project.id}/invitations`)
      .set(owner.auth)
      .send({ email: invitee.user.email });

    const res = await request(app)
      .post(`${api}/invitations/${inv.body.data.id}/accept`)
      .set(thief.auth);
    expect(res.status).toBe(404);
  });

  it('rejects duplicates, existing members, and invites from plain members', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const project = await createProject(owner.auth);
    await addMember(owner.auth, project.id, member);
    const url = `${api}/projects/${project.id}/invitations`;

    expect(
      (await request(app).post(url).set(owner.auth).send({ email: member.user.email })).status,
    ).toBe(409);

    await request(app).post(url).set(owner.auth).send({ email: 'x@example.com' });
    expect(
      (await request(app).post(url).set(owner.auth).send({ email: 'x@example.com' })).status,
    ).toBe(409);

    expect(
      (await request(app).post(url).set(member.auth).send({ email: 'y@example.com' })).status,
    ).toBe(403);
  });

  it('only the owner can invite admins; revoked invitations disappear', async () => {
    const owner = await registerUser(app);
    const admin = await registerUser(app);
    const project = await createProject(owner.auth);
    await addMember(owner.auth, project.id, admin, 'ADMIN');
    const url = `${api}/projects/${project.id}/invitations`;

    const asAdmin = await request(app)
      .post(url)
      .set(admin.auth)
      .send({ email: 'z@example.com', role: 'ADMIN' });
    expect(asAdmin.status).toBe(403);

    const inv = await request(app).post(url).set(admin.auth).send({ email: 'z@example.com' });
    expect((await request(app).delete(`${url}/${inv.body.data.id}`).set(admin.auth)).status).toBe(
      204,
    );
    const list = await request(app).get(`${url}?status=REVOKED`).set(owner.auth);
    expect(list.body.data).toHaveLength(1);
  });
});

describe('members', () => {
  it('owner changes roles; nobody changes the owner', async () => {
    const owner = await registerUser(app);
    const member = await registerUser(app);
    const project = await createProject(owner.auth);
    await addMember(owner.auth, project.id, member);
    const base = `${api}/projects/${project.id}/members`;

    const promote = await request(app)
      .patch(`${base}/${member.user.id}`)
      .set(owner.auth)
      .send({ role: 'ADMIN' });
    expect(promote.status).toBe(200);
    expect(promote.body.data.role).toBe('ADMIN');

    const demoteOwner = await request(app)
      .patch(`${base}/${owner.user.id}`)
      .set(owner.auth)
      .send({ role: 'MEMBER' });
    expect(demoteOwner.status).toBe(400);

    const byAdmin = await request(app)
      .patch(`${base}/${owner.user.id}`)
      .set(member.auth)
      .send({ role: 'MEMBER' });
    expect(byAdmin.status).toBe(403);
  });

  it('applies the removal rules and lets members leave', async () => {
    const owner = await registerUser(app);
    const admin = await registerUser(app);
    const m1 = await registerUser(app);
    const m2 = await registerUser(app);
    const project = await createProject(owner.auth);
    await addMember(owner.auth, project.id, admin, 'ADMIN');
    await addMember(owner.auth, project.id, m1);
    await addMember(owner.auth, project.id, m2);
    const base = `${api}/projects/${project.id}/members`;

    expect((await request(app).delete(`${base}/${m2.user.id}`).set(m1.auth)).status).toBe(403);
    expect((await request(app).delete(`${base}/${owner.user.id}`).set(admin.auth)).status).toBe(
      403,
    );
    expect((await request(app).delete(`${base}/${m2.user.id}`).set(admin.auth)).status).toBe(204);
    expect((await request(app).delete(`${base}/${m1.user.id}`).set(m1.auth)).status).toBe(204);
    expect((await request(app).delete(`${base}/${owner.user.id}`).set(owner.auth)).status).toBe(
      400,
    );
    expect((await request(app).delete(`${base}/${admin.user.id}`).set(owner.auth)).status).toBe(
      204,
    );

    const members = await request(app).get(base).set(owner.auth);
    expect(members.body.data).toHaveLength(1);
  });
});
