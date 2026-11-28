import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as connect } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { closeRealtime, initRealtime } from '../../src/realtime/socket.js';
import {
  notify,
  sendInitialCount,
  withNotifications,
} from '../../src/modules/notifications/notifications.service.js';
import { resetDatabase } from '../helpers/db.js';
import { registerUser } from '../helpers/auth.js';
import { addMember, createProject } from '../helpers/projects.js';

const app = createApp();
const api = '/api/v1';

// A real HTTP server on a random port so Socket.IO can be tested end to end.
const server = http.createServer(app);
let url;

beforeAll(async () => {
  initRealtime(server, { onConnect: sendInitialCount });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});
afterAll(async () => {
  await closeRealtime();
  await prisma.$disconnect();
});
beforeEach(resetDatabase);

async function team() {
  const owner = await registerUser(app);
  const member = await registerUser(app);
  const project = await createProject(app, owner);
  await addMember(app, owner, project.id, member);
  return { owner, member, project };
}

const notificationsOf = async (user, query = '') =>
  (await request(app).get(`${api}/notifications${query}`).set(user.auth)).body;

/** Connects a socket and resolves once the server has accepted it (first count event). */
function openSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('notification:count', (count) => resolve({ socket, initialCount: count }));
    socket.once('connect_error', reject);
  });
}

function nextEvent(socket, event, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no ${event} within ${timeoutMs}ms`)),
      timeoutMs,
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('stored notifications (US13)', () => {
  it('notifies the assignee when a task is assigned, not the person assigning', async () => {
    const { owner, member, project } = await team();
    await request(app)
      .post(`${api}/tasks`)
      .set(owner.auth)
      .send({ title: 'Fix login bug', projectId: project.id, assigneeId: member.user.id });

    const mine = await notificationsOf(member);
    // The invitation acceptance came first; the assignment is newest.
    expect(mine.data[0]).toMatchObject({
      type: 'TASK_ASSIGNED',
      title: `${owner.user.name} assigned you "Fix login bug"`,
      actor: { id: owner.user.id },
      readAt: null,
    });
    expect((await notificationsOf(owner)).data).toHaveLength(0);
  });

  it('notifies creator and assignee about updates, completion and comments', async () => {
    const { owner, member, project } = await team();
    const task = (
      await request(app)
        .post(`${api}/tasks`)
        .set(owner.auth)
        .send({ title: 'Ship', projectId: project.id, assigneeId: member.user.id })
    ).body.data;

    await request(app)
      .patch(`${api}/tasks/${task.id}`)
      .set(owner.auth)
      .send({ priority: 'URGENT', dueDate: '2026-12-24' });
    await request(app)
      .patch(`${api}/tasks/${task.id}`)
      .set(member.auth)
      .send({ status: 'COMPLETED' });
    await request(app)
      .post(`${api}/tasks/${task.id}/comments`)
      .set(member.auth)
      .send({ body: 'Done!' });

    const memberTypes = (await notificationsOf(member)).data.map((n) => n.type);
    expect(memberTypes.slice(0, 2)).toEqual(['TASK_UPDATED', 'TASK_ASSIGNED']);
    const updated = (await notificationsOf(member)).data[0];
    expect(updated.body).toBe('Changed: priority, due date');

    const ownerList = (await notificationsOf(owner)).data;
    expect(ownerList.map((n) => n.type)).toEqual(['TASK_COMMENTED', 'TASK_COMPLETED']);
    expect(ownerList[0].body).toBe('Done!');
  });

  it('notifies a registered invitee', async () => {
    const owner = await registerUser(app);
    const invitee = await registerUser(app);
    const project = await createProject(app, owner, { name: 'Moonshot' });
    await request(app)
      .post(`${api}/projects/${project.id}/invitations`)
      .set(owner.auth)
      .send({ email: invitee.user.email });

    const [n] = (await notificationsOf(invitee)).data;
    expect(n).toMatchObject({ type: 'PROJECT_INVITATION', projectId: project.id });
    expect(n.title).toContain('"Moonshot"');
  });

  it('filters unread, marks one and all as read, and keeps them private', async () => {
    const { owner, member, project } = await team();
    for (const title of ['a', 'b', 'c']) {
      await request(app)
        .post(`${api}/tasks`)
        .set(owner.auth)
        .send({ title, projectId: project.id, assigneeId: member.user.id });
    }

    // 3 assignments + the invitation from joining the project.
    const all = await notificationsOf(member, '?unread=true');
    expect(all.meta.unread).toBe(4);

    const one = all.data[0];
    expect(
      (await request(app).patch(`${api}/notifications/${one.id}/read`).set(owner.auth)).status,
    ).toBe(404);
    const read = await request(app).patch(`${api}/notifications/${one.id}/read`).set(member.auth);
    expect(read.body.data.readAt).not.toBeNull();
    expect((await notificationsOf(member, '?unread=true')).meta.unread).toBe(3);

    const rest = await request(app).post(`${api}/notifications/read-all`).set(member.auth);
    expect(rest.body.data).toEqual({ marked: 3 });
    expect((await notificationsOf(member)).meta.unread).toBe(0);
  });
});

describe('transactional notifications', () => {
  it('rolls the change back when its notification cannot be written', async () => {
    const { owner, project } = await team();
    const task = (
      await request(app)
        .post(`${api}/tasks`)
        .set(owner.auth)
        .send({ title: 'Original', projectId: project.id })
    ).body.data;
    // Setup already produced notifications (the member's invitation); none may be added.
    const before = await prisma.notification.count();

    // A recipient that doesn't exist violates the notification's foreign key mid-transaction.
    await expect(
      withNotifications(async (tx, outbox) => {
        await tx.task.update({ where: { id: task.id }, data: { title: 'Changed' } });
        outbox.push(
          ...(await notify(tx, {
            recipients: [randomUUID()],
            actorId: owner.user.id,
            type: 'TASK_UPDATED',
            title: (name) => `${name} changed a task`,
            taskId: task.id,
          })),
        );
      }),
    ).rejects.toThrow();

    expect((await prisma.task.findUnique({ where: { id: task.id } })).title).toBe('Original');
    expect(await prisma.notification.count()).toBe(before);
  });

  it('does not push notifications for a transaction that rolled back', async () => {
    const { owner, member } = await team();
    const { socket } = await openSocket(member.token);
    const before = await prisma.notification.count();
    try {
      const pushed = nextEvent(socket, 'notification', 500);
      await expect(
        withNotifications(async (tx, outbox) => {
          outbox.push(
            ...(await notify(tx, {
              recipients: [member.user.id],
              actorId: owner.user.id,
              type: 'TASK_UPDATED',
              title: (name) => `${name} did something`,
            })),
          );
          throw new Error('later step failed');
        }),
      ).rejects.toThrow('later step failed');
      await expect(pushed).rejects.toThrow(/no notification/);
      expect(await prisma.notification.count()).toBe(before);
    } finally {
      socket.disconnect();
    }
  });
});

describe('real-time delivery over Socket.IO (US13)', () => {
  it('rejects connections without a valid token', async () => {
    await expect(openSocket('not-a-token')).rejects.toThrow(/invalid|expired/i);
  });

  it('pushes the notification and the new unread count to the assignee', async () => {
    const { owner, member, project } = await team();
    const { socket, initialCount } = await openSocket(member.token);
    try {
      // The invitation they got when joining is still unread.
      expect(initialCount).toEqual({ unread: 1 });

      const pushed = nextEvent(socket, 'notification');
      const count = nextEvent(socket, 'notification:count');
      await request(app)
        .post(`${api}/tasks`)
        .set(owner.auth)
        .send({ title: 'Live one', projectId: project.id, assigneeId: member.user.id });

      expect(await pushed).toMatchObject({
        type: 'TASK_ASSIGNED',
        title: expect.stringContaining('Live one'),
      });
      expect(await count).toEqual({ unread: 2 });
    } finally {
      socket.disconnect();
    }
  });

  it('disconnects the socket when that session logs out', async () => {
    const { member } = await team();
    const { socket } = await openSocket(member.token);
    const disconnected = nextEvent(socket, 'disconnect');
    await request(app).post(`${api}/auth/logout`).set(member.auth);
    expect(await disconnected).toBe('io server disconnect');
  });
});
