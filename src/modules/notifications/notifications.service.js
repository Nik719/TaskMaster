// Creates notifications and pushes them to connected clients.
//
// Notification rows are written in the *same transaction* as the change that caused them
// (see withNotifications), so a task update and its notifications commit or roll back
// together. Only the Socket.IO push happens after commit; it is best-effort because the
// stored row is the source of truth and clients re-fetch it on reconnect.
import { prisma } from '../../config/prisma.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import { publicUserSelect } from '../../utils/serializers.js';
import { pageArgs, pageMeta } from '../../utils/pagination.js';
import { emitToUser } from '../../realtime/socket.js';

export const EVENTS = Object.freeze({
  NOTIFICATION: 'notification',
  COUNT: 'notification:count',
});

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  taskId: true,
  projectId: true,
  readAt: true,
  createdAt: true,
  actor: { select: publicUserSelect },
};

export function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

async function pushCount(userId) {
  emitToUser(userId, EVENTS.COUNT, { unread: await unreadCount(userId) });
}

/**
 * Inserts notification rows using `db` (a transaction client) and returns them for
 * publishing after commit. Errors propagate so the surrounding transaction rolls back.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} db
 * @param {object} n
 * @param {Array<string|null|undefined>} n.recipients user IDs; duplicates, empties and the actor are dropped
 * @param {string} n.actorId who caused it (never notified about their own action)
 * @param {string} n.type NotificationType
 * @param {(actorName: string) => string} n.title builds the headline from the actor's name
 * @param {string} [n.body]
 * @param {string} [n.taskId]
 * @param {string} [n.projectId]
 * @returns {Promise<Array<object>>}
 */
export async function notify(db, { recipients, actorId, type, title, body, taskId, projectId }) {
  const userIds = [...new Set(recipients.filter((id) => id && id !== actorId))];
  if (userIds.length === 0) return [];

  const actor = await db.user.findUnique({ where: { id: actorId }, select: { name: true } });
  const headline = title(actor?.name ?? 'Someone').slice(0, 300);

  return db.notification.createManyAndReturn({
    data: userIds.map((userId) => ({
      userId,
      actorId,
      type,
      title: headline,
      body: body?.slice(0, 1000),
      taskId,
      projectId,
    })),
    select: { userId: true, ...notificationSelect },
  });
}

/** Pushes committed notifications to connected clients. Never throws: delivery is best-effort. */
export async function publish(notifications) {
  if (notifications.length === 0) return;
  try {
    const recipients = new Set();
    for (const { userId, ...notification } of notifications) {
      emitToUser(userId, EVENTS.NOTIFICATION, notification);
      recipients.add(userId);
    }
    await Promise.all([...recipients].map(pushCount));
  } catch (err) {
    logger.warn({ err }, 'Failed to push notifications');
  }
}

/**
 * Transactional event pattern: runs `work(tx, outbox)` in one database transaction, where
 * `outbox` collects the notifications created inside it. They are published only after the
 * transaction commits, so clients are never told about a change that was rolled back.
 *
 * @template T
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient, outbox: object[]) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withNotifications(work) {
  const outbox = [];
  const result = await prisma.$transaction((tx) => work(tx, outbox));
  await publish(outbox);
  return result;
}

export async function listNotifications(userId, { unread, ...page }) {
  const where = { userId, ...(unread && { readAt: null }) };
  const [data, total, unreadTotal] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageArgs(page),
    }),
    prisma.notification.count({ where }),
    unreadCount(userId),
  ]);
  return { data, meta: { ...pageMeta(page, total), unread: unreadTotal } };
}

export async function markRead(notificationId, userId) {
  const { count } = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  if (count === 0) throw ApiError.notFound('Notification not found');
  await pushCount(userId);
  return prisma.notification.findUnique({
    where: { id: notificationId },
    select: notificationSelect,
  });
}

export async function markAllRead(userId) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  await pushCount(userId);
  return { marked: count };
}

/** Sent right after a socket connects, so the badge is correct immediately. */
export async function sendInitialCount(socket) {
  socket.emit(EVENTS.COUNT, { unread: await unreadCount(socket.data.user.id) });
}
