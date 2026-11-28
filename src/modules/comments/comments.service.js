import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { publicUserSelect } from '../../utils/serializers.js';
import { pageArgs, pageMeta } from '../../utils/pagination.js';
import { isManager } from '../projects/access.js';
import { getAccessibleTask } from '../tasks/tasks.service.js';
import * as taskEvents from '../notifications/taskEvents.js';
import { withNotifications } from '../notifications/notifications.service.js';

const commentSelect = {
  id: true,
  taskId: true,
  body: true,
  editedAt: true,
  createdAt: true,
  author: { select: publicUserSelect },
};

export async function listComments(taskId, userId, query) {
  await getAccessibleTask(taskId, userId);
  const where = { taskId };
  const [data, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      select: commentSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      ...pageArgs(query),
    }),
    prisma.comment.count({ where }),
  ]);
  return { data, meta: pageMeta(query, total) };
}

/** Returns the comment and the task (for notifications). */
export async function addComment(taskId, userId, body) {
  const { task } = await getAccessibleTask(taskId, userId);
  const comment = await withNotifications(async (tx, outbox) => {
    const created = await tx.comment.create({
      data: { taskId, authorId: userId, body },
      select: commentSelect,
    });
    outbox.push(...(await taskEvents.taskCommented(tx, userId, task, created)));
    return created;
  });
  return { comment, task };
}

async function findComment(taskId, commentId) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, taskId },
    select: { id: true, authorId: true },
  });
  if (!comment) throw ApiError.notFound('Comment not found');
  return comment;
}

/** Only the author can edit their words. */
export async function editComment(taskId, commentId, userId, body) {
  await getAccessibleTask(taskId, userId);
  const comment = await findComment(taskId, commentId);
  if (comment.authorId !== userId) throw ApiError.forbidden('You can only edit your own comments');
  return prisma.comment.update({
    where: { id: commentId },
    data: { body, editedAt: new Date() },
    select: commentSelect,
  });
}

/** The author, or a project owner/admin (moderation), can delete. */
export async function deleteComment(taskId, commentId, userId) {
  const { role } = await getAccessibleTask(taskId, userId);
  const comment = await findComment(taskId, commentId);
  if (comment.authorId !== userId && !isManager(role)) {
    throw ApiError.forbidden('You can only delete your own comments');
  }
  await prisma.comment.delete({ where: { id: commentId } });
}
