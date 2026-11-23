import fs from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { pathFor } from '../../src/storage/localStorage.js';
import { resetDatabase } from '../helpers/db.js';
import { registerUser } from '../helpers/auth.js';
import { addMember, createProject } from '../helpers/projects.js';

const app = createApp();
const api = '/api/v1';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/** Owner + member sharing a project, plus an outsider and a task in the project. */
async function setup() {
  const owner = await registerUser(app);
  const member = await registerUser(app);
  const outsider = await registerUser(app);
  const project = await createProject(app, owner);
  await addMember(app, owner, project.id, member);
  const task = (
    await request(app)
      .post(`${api}/tasks`)
      .set(owner.auth)
      .send({ title: 'Ship v1', projectId: project.id })
  ).body.data;
  return { owner, member, outsider, project, task };
}

describe('comments (US10)', () => {
  it('members comment, list in order, edit their own', async () => {
    const { owner, member, task } = await setup();
    const url = `${api}/tasks/${task.id}/comments`;

    const first = await request(app).post(url).set(owner.auth).send({ body: 'Kicking this off' });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({
      body: 'Kicking this off',
      author: { id: owner.user.id },
    });
    await request(app).post(url).set(member.auth).send({ body: 'On it' });

    const list = await request(app).get(url).set(member.auth);
    expect(list.body.data.map((c) => c.body)).toEqual(['Kicking this off', 'On it']);
    expect(list.body.meta.total).toBe(2);

    const edit = await request(app)
      .patch(`${url}/${first.body.data.id}`)
      .set(owner.auth)
      .send({ body: 'Kicking this off today' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.editedAt).not.toBeNull();

    const notMine = await request(app)
      .patch(`${url}/${first.body.data.id}`)
      .set(member.auth)
      .send({ body: 'hijack' });
    expect(notMine.status).toBe(403);
  });

  it('authors and managers can delete; other members cannot', async () => {
    const { owner, member, project, task } = await setup();
    const other = await registerUser(app);
    await addMember(app, owner, project.id, other);
    const url = `${api}/tasks/${task.id}/comments`;
    const c1 = (await request(app).post(url).set(member.auth).send({ body: 'one' })).body.data;
    const c2 = (await request(app).post(url).set(member.auth).send({ body: 'two' })).body.data;

    expect((await request(app).delete(`${url}/${c1.id}`).set(other.auth)).status).toBe(403);
    expect((await request(app).delete(`${url}/${c1.id}`).set(member.auth)).status).toBe(204);
    expect((await request(app).delete(`${url}/${c2.id}`).set(owner.auth)).status).toBe(204);
  });

  it('outsiders get 404 and empty comments are rejected', async () => {
    const { owner, outsider, task } = await setup();
    const url = `${api}/tasks/${task.id}/comments`;
    expect((await request(app).get(url).set(outsider.auth)).status).toBe(404);
    expect((await request(app).post(url).set(outsider.auth).send({ body: 'hi' })).status).toBe(404);
    expect((await request(app).post(url).set(owner.auth).send({ body: '   ' })).status).toBe(400);
  });
});

describe('attachments (US10)', () => {
  const pdf = Buffer.from('%PDF-1.4 fake pdf for tests');

  it('uploads, lists, downloads and deletes a file', async () => {
    const { owner, member, task } = await setup();
    const url = `${api}/tasks/${task.id}/attachments`;

    const up = await request(app)
      .post(url)
      .set(member.auth)
      .attach('file', pdf, { filename: 'Spec – v2.pdf', contentType: 'application/pdf' });
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    expect(up.body.data).toMatchObject({
      originalName: 'Spec – v2.pdf',
      mimeType: 'application/pdf',
      size: pdf.length,
      uploader: { id: member.user.id },
    });
    expect(up.body.data.storageKey).toBeUndefined();

    const list = await request(app).get(url).set(owner.auth);
    expect(list.body.data).toHaveLength(1);

    const dl = await request(app)
      .get(`${url}/${up.body.data.id}/download`)
      .set(owner.auth)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toMatch(/^attachment;/);
    expect(dl.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(dl.body, pdf)).toBe(0);

    const row = await prisma.attachment.findUnique({ where: { id: up.body.data.id } });
    expect(fs.existsSync(pathFor(row.storageKey))).toBe(true);
    expect((await request(app).delete(`${url}/${up.body.data.id}`).set(owner.auth)).status).toBe(
      204,
    );
    expect(fs.existsSync(pathFor(row.storageKey))).toBe(false);
  });

  it('rejects disallowed types, missing files and outsiders (without writing files)', async () => {
    const { owner, outsider, task } = await setup();
    const url = `${api}/tasks/${task.id}/attachments`;

    const html = await request(app)
      .post(url)
      .set(owner.auth)
      .attach('file', Buffer.from('<script>alert(1)</script>'), {
        filename: 'x.html',
        contentType: 'text/html',
      });
    expect(html.status).toBe(415);
    expect(html.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    const none = await request(app).post(url).set(owner.auth).field('note', 'no file');
    expect(none.status).toBe(400);

    const before = fs.readdirSync(pathFor('x').replace(/x$/, '')).length;
    const intruder = await request(app)
      .post(url)
      .set(outsider.auth)
      .attach('file', pdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(intruder.status).toBe(404);
    expect(fs.readdirSync(pathFor('x').replace(/x$/, '')).length).toBe(before);
  });

  it('only the uploader or a manager can delete; deleting the task removes its files', async () => {
    const { owner, member, project, task } = await setup();
    const other = await registerUser(app);
    await addMember(app, owner, project.id, other);
    const url = `${api}/tasks/${task.id}/attachments`;
    const up = await request(app)
      .post(url)
      .set(member.auth)
      .attach('file', pdf, { filename: 'a.pdf', contentType: 'application/pdf' });
    const { storageKey } = await prisma.attachment.findUnique({ where: { id: up.body.data.id } });

    expect((await request(app).delete(`${url}/${up.body.data.id}`).set(other.auth)).status).toBe(
      403,
    );

    expect((await request(app).delete(`${api}/tasks/${task.id}`).set(owner.auth)).status).toBe(204);
    expect(fs.existsSync(pathFor(storageKey))).toBe(false);
  });
});
