// Creates notifications and pushes them to connected clients.
//
// notify() is called by other services after their change has been saved. It never throws:
// a failed notification must not turn a successful task update into an error response.
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
 * @param {object} n
 * @param {Array<string|null|undefined>} n.recipients user IDs; duplicates, empties and the actor are dropped
 * @param {string} n.actorId who caused it (never notified about their own action)
 * @param {string} n.type NotificationType
 * @param {(actorName: string) => string} n.title builds the headline from the actor's name
 * @param {string} [n.body]
 * @param {string} [n.taskId]
 * @param {string} [n.projectId]
 */
export async function notify({ recipients, actorId, type, title, body, taskId, projectId }) {
  try {
    const userIds = [...new Set(recipients.filter((id) => id && id !== actorId))];
    if (userIds.length === 0) return;

    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
    const headline = title(actor?.name ?? 'Someone').slice(0, 300);

    const created = await prisma.notification.createManyAndReturn({
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

    await Promise.all(
      created.map(async ({ userId, ...notification }) => {
        emitToUser(userId, EVENTS.NOTIFICATION, notification);
        await pushCount(userId);
      }),
    );
  } catch (err) {
    logger.error({ err, type, taskId }, 'Failed to create notification');
  }
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
