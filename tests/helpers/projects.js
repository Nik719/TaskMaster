import request from 'supertest';

/** Creates a project owned by `owner` and returns it. */
export async function createProject(app, owner, body = { name: 'Apollo' }) {
  const res = await request(app).post('/api/v1/projects').set(owner.auth).send(body);
  if (res.status !== 201) throw new Error(`create project failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Invites `invitee` into the project and accepts on their behalf. */
export async function addMember(app, owner, projectId, invitee, role = 'MEMBER') {
  const inv = await request(app)
    .post(`/api/v1/projects/${projectId}/invitations`)
    .set(owner.auth)
    .send({ email: invitee.user.email, role });
  if (inv.status !== 201) throw new Error(`invite failed: ${JSON.stringify(inv.body)}`);
  const res = await request(app)
    .post(`/api/v1/invitations/${inv.body.data.id}/accept`)
    .set(invitee.auth);
  if (res.status !== 200) throw new Error(`accept failed: ${JSON.stringify(res.body)}`);
}
