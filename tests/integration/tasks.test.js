import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { resetDatabase } from '../helpers/db.js';
import { registerUser } from '../helpers/auth.js';
import { addMember, createProject } from '../helpers/projects.js';

const app = createApp();
const api = '/api/v1';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function createTask(user, body) {
  const res = await request(app).post(`${api}/tasks`).set(user.auth).send(body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data;
}

/** An owner, a member and a project they share. */
async function team() {
  const owner = await registerUser(app);
  const member = await registerUser(app);
  const project = await createProject(app, owner);
  await addMember(app, owner, project.id, member);
  return { owner, member, project };
}

describe('creating tasks (US4)', () => {
  it('creates a project task with title, description and due date', async () => {
    const { owner, member, project } = await team();
    const task = await createTask(owner, {
      title: 'Write release notes',
      description: 'Cover the invite flow',
      dueDate: '2026-12-01',
      priority: 'HIGH',
      projectId: project.id,
      assigneeId: member.user.id,
    });

    expect(task).toMatchObject({
      title: 'Write release notes',
      description: 'Cover the invite flow',
      status: 'OPEN',
      priority: 'HIGH',
      dueDate: '2026-12-01T00:00:00.000Z',
      project: { id: project.id },
      creator: { id: owner.user.id },
      assignee: { id: member.user.id },
      completedAt: null,
    });
  });

  it('creates personal tasks that only the creator can see', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    const task = await createTask(a, { title: 'Buy milk' });
    expect(task.project).toBeNull();

    expect((await request(app).get(`${api}/tasks/${task.id}`).set(a.auth)).status).toBe(200);
    expect((await request(app).get(`${api}/tasks/${task.id}`).set(b.auth)).status).toBe(404);
  });

  it('validates input', async () => {
    const a = await registerUser(app);
    const res = await request(app)
      .post(`${api}/tasks`)
      .set(a.auth)
      .send({ title: '', dueDate: 'next tuesday', priority: 'MEGA' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual([
      'dueDate',
      'priority',
      'title',
    ]);
  });

  it("refuses projects you're not in and assignees outside the project", async () => {
    const { owner, project } = await team();
    const outsider = await registerUser(app);

    const notMember = await request(app)
      .post(`${api}/tasks`)
      .set(outsider.auth)
      .send({ title: 'x', projectId: project.id });
    expect(notMember.status).toBe(404);

    const badAssignee = await request(app)
      .post(`${api}/tasks`)
      .set(owner.auth)
      .send({ title: 'x', projectId: project.id, assigneeId: outsider.user.id });
    expect(badAssignee.status).toBe(400);

    const personalOther = await request(app)
      .post(`${api}/tasks`)
      .set(owner.auth)
      .send({ title: 'x', assigneeId: outsider.user.id });
    expect(personalOther.status).toBe(400);
  });
});

describe('assigning and completing (US6, US7)', () => {
  it('assigns to a team member, then they mark it completed', async () => {
    const { owner, member, project } = await team();
    const task = await createTask(owner, { title: 'Fix login bug', projectId: project.id });

    const assigned = await request(app)
      .patch(`${api}/tasks/${task.id}`)
      .set(owner.auth)
      .send({ assigneeId: member.user.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.assignee.id).toBe(member.user.id);

    const done = await request(app)
      .patch(`${api}/tasks/${task.id}`)
      .set(member.auth)
      .send({ status: 'COMPLETED' });
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.completedAt).not.toBeNull();

    const reopened = await request(app)
      .patch(`${api}/tasks/${task.id}`)
      .set(member.auth)
      .send({ status: 'OPEN' });
    expect(reopened.body.data.completedAt).toBeNull();
  });

  it('unassigns with null and clears assignments when a member leaves', async () => {
    const { owner, member, project } = await team();
    const t1 = await createTask(owner, {
      title: 'a',
      projectId: project.id,
      assigneeId: member.user.id,
    });
    const t2 = await createTask(owner, {
      title: 'b',
      projectId: project.id,
      assigneeId: member.user.id,
    });

    const res = await request(app)
      .patch(`${api}/tasks/${t1.id}`)
      .set(owner.auth)
      .send({ assigneeId: null });
    expect(res.body.data.assignee).toBeNull();

    await request(app)
      .delete(`${api}/projects/${project.id}/members/${member.user.id}`)
      .set(member.auth);
    const after = await request(app).get(`${api}/tasks/${t2.id}`).set(owner.auth);
    expect(after.body.data.assignee).toBeNull();
  });
});

describe('deleting', () => {
  it('allows the creator or an owner/admin, not other members', async () => {
    const { owner, member, project } = await team();
    const other = await registerUser(app);
    await addMember(app, owner, project.id, other);
    const byMember = await createTask(member, { title: 'mine', projectId: project.id });
    const byOwner = await createTask(owner, { title: 'boss', projectId: project.id });

    expect((await request(app).delete(`${api}/tasks/${byOwner.id}`).set(member.auth)).status).toBe(
      403,
    );
    expect((await request(app).delete(`${api}/tasks/${byMember.id}`).set(other.auth)).status).toBe(
      403,
    );
    expect((await request(app).delete(`${api}/tasks/${byMember.id}`).set(owner.auth)).status).toBe(
      204,
    );
    expect((await request(app).get(`${api}/tasks/${byMember.id}`).set(owner.auth)).status).toBe(
      404,
    );
  });
});

describe('listing: filter, search, sort, paginate (US5, US8, US9)', () => {
  async function seed() {
    const { owner, member, project } = await team();
    const outsider = await registerUser(app);
    const base = { projectId: project.id };
    await createTask(owner, {
      ...base,
      title: 'Design invoice page',
      priority: 'LOW',
      dueDate: '2026-12-05',
      assigneeId: member.user.id,
    });
    await createTask(owner, {
      ...base,
      title: 'Write API docs',
      description: 'Include the INVOICE endpoints',
      priority: 'URGENT',
      dueDate: '2026-12-01',
    });
    await createTask(member, {
      ...base,
      title: 'Deploy',
      status: 'COMPLETED',
      priority: 'HIGH',
      assigneeId: member.user.id,
    });
    await createTask(member, { title: 'Personal errand', dueDate: '2020-01-01' });
    await createTask(outsider, { title: 'Invoice for someone else' });
    return { owner, member, project };
  }

  const titles = (res) => res.body.data.map((t) => t.title);

  it('only returns tasks I can see', async () => {
    const { owner, member } = await seed();
    const ownerView = await request(app).get(`${api}/tasks`).set(owner.auth);
    expect(ownerView.body.meta.total).toBe(3);
    const memberView = await request(app).get(`${api}/tasks`).set(member.auth);
    expect(memberView.body.meta.total).toBe(4);
  });

  it('assigneeId=me lists the tasks assigned to me (US5)', async () => {
    const { member } = await seed();
    const res = await request(app)
      .get(`${api}/tasks?assigneeId=me&sortBy=title&order=asc`)
      .set(member.auth);
    expect(titles(res)).toEqual(['Deploy', 'Design invoice page']);
  });

  it('filters by status (US8), priority, project and overdue', async () => {
    const { member, project } = await seed();
    const open = await request(app).get(`${api}/tasks?status=open,in_progress`).set(member.auth);
    expect(open.body.meta.total).toBe(3);
    const done = await request(app).get(`${api}/tasks?status=COMPLETED`).set(member.auth);
    expect(titles(done)).toEqual(['Deploy']);

    const urgent = await request(app).get(`${api}/tasks?priority=HIGH,URGENT`).set(member.auth);
    expect(urgent.body.meta.total).toBe(2);

    const personal = await request(app).get(`${api}/tasks?projectId=none`).set(member.auth);
    expect(titles(personal)).toEqual(['Personal errand']);
    const inProject = await request(app)
      .get(`${api}/tasks?projectId=${project.id}`)
      .set(member.auth);
    expect(inProject.body.meta.total).toBe(3);

    const overdue = await request(app).get(`${api}/tasks?overdue=true`).set(member.auth);
    expect(titles(overdue)).toEqual(['Personal errand']);

    const bad = await request(app).get(`${api}/tasks?status=DONEISH`).set(member.auth);
    expect(bad.status).toBe(400);
  });

  it('searches title or description, case-insensitively (US9)', async () => {
    const { member } = await seed();
    const res = await request(app)
      .get(`${api}/tasks?q=invoice&sortBy=title&order=asc`)
      .set(member.auth);
    expect(titles(res)).toEqual(['Design invoice page', 'Write API docs']);
  });

  it('sorts by due date (empty dates last) and by priority', async () => {
    const { owner } = await seed();
    const byDue = await request(app).get(`${api}/tasks?sortBy=dueDate&order=asc`).set(owner.auth);
    expect(titles(byDue)).toEqual(['Write API docs', 'Design invoice page', 'Deploy']);

    const byPriority = await request(app)
      .get(`${api}/tasks?sortBy=priority&order=desc`)
      .set(owner.auth);
    expect(titles(byPriority)).toEqual(['Write API docs', 'Deploy', 'Design invoice page']);
  });

  it('paginates', async () => {
    const { owner } = await seed();
    const page2 = await request(app)
      .get(`${api}/tasks?limit=2&page=2&sortBy=title&order=asc`)
      .set(owner.auth);
    expect(page2.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(titles(page2)).toEqual(['Write API docs']);
  });

  it('filters by due date range', async () => {
    const { owner } = await seed();
    const res = await request(app)
      .get(`${api}/tasks?dueFrom=2026-12-02&dueTo=2026-12-31`)
      .set(owner.auth);
    expect(titles(res)).toEqual(['Design invoice page']);
    const bad = await request(app)
      .get(`${api}/tasks?dueFrom=2026-12-31&dueTo=2026-12-01`)
      .set(owner.auth);
    expect(bad.status).toBe(400);
  });
});
