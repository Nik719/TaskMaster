import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { publicUserSelect } from '../../utils/serializers.js';
import { pageArgs, pageMeta } from '../../utils/pagination.js';
import { getMembership, isManager, requireMember } from '../projects/access.js';

export const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
  creator: { select: publicUserSelect },
  assignee: { select: publicUserSelect },
};

/** Tasks a user may see: everything in their projects, plus their own personal tasks. */
export function visibleTasksWhere(userId) {
  return {
    OR: [{ project: { members: { some: { userId } } } }, { projectId: null, creatorId: userId }],
  };
}

/**
 * Loads a task the user is allowed to see, with their role in its project (null for a
 * personal task). Throws 404 otherwise. Used by tasks, comments, attachments and AI.
 */
export async function getAccessibleTask(taskId, userId) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...visibleTasksWhere(userId) },
    select: { id: true, projectId: true, creatorId: true, assigneeId: true, status: true },
  });
  if (!task) throw ApiError.notFound('Task not found');

  const role = task.projectId ? (await getMembership(task.projectId, userId))?.role : null;
  return { task, role };
}

/** The assignee must be able to see the task: a project member, or the creator for personal tasks. */
async function assertAssignable({ projectId, creatorId }, assigneeId) {
  if (!assigneeId) return;
  if (!projectId) {
    if (assigneeId !== creatorId) {
      throw ApiError.badRequest(
        'Personal tasks can only be assigned to yourself. Create the task in a project to assign it to someone else.',
      );
    }
    return;
  }
  if (!(await getMembership(projectId, assigneeId))) {
    throw ApiError.badRequest('The assignee must be a member of the project');
  }
}

/** completedAt follows status: stamped on completion, cleared when reopened. */
function completionFields(status, previousStatus) {
  if (status === undefined || status === previousStatus) return {};
  return { completedAt: status === 'COMPLETED' ? new Date() : null };
}

export async function createTask(userId, input) {
  const { projectId, ...fields } = input;
  if (projectId) await requireMember(projectId, userId);
  await assertAssignable({ projectId, creatorId: userId }, fields.assigneeId);

  return prisma.task.create({
    data: {
      ...fields,
      ...completionFields(fields.status, undefined),
      projectId: projectId ?? null,
      creatorId: userId,
    },
    select: taskSelect,
  });
}

export async function getTask(taskId, userId) {
  await getAccessibleTask(taskId, userId);
  return prisma.task.findUnique({ where: { id: taskId }, select: taskSelect });
}

/**
 * Any member who can see the task can update it (collaboration). Returns the updated task
 * and the previous values of the fields that changed, which drive notifications.
 */
export async function updateTask(taskId, userId, changes) {
  const { task } = await getAccessibleTask(taskId, userId);
  if (changes.assigneeId !== undefined && changes.assigneeId !== task.assigneeId) {
    await assertAssignable(task, changes.assigneeId);
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { ...changes, ...completionFields(changes.status, task.status) },
    select: taskSelect,
  });
  return { task: updated, previous: task };
}

/** The creator, or a project owner/admin, may delete a task. */
export async function deleteTask(taskId, userId) {
  const { task, role } = await getAccessibleTask(taskId, userId);
  if (task.creatorId !== userId && !isManager(role)) {
    throw ApiError.forbidden('Only the task creator or a project owner/admin can delete this task');
  }
  await prisma.task.delete({ where: { id: taskId } });
  return task;
}

// ── Listing ──

function resolvePerson(value, userId) {
  return value === 'me' ? userId : value;
}

function buildFilters(userId, q) {
  const and = [visibleTasksWhere(userId)];

  if (q.projectId) and.push({ projectId: q.projectId === 'none' ? null : q.projectId });
  if (q.status) and.push({ status: { in: q.status } });
  if (q.priority) and.push({ priority: { in: q.priority } });
  if (q.assigneeId) {
    and.push({ assigneeId: q.assigneeId === 'none' ? null : resolvePerson(q.assigneeId, userId) });
  }
  if (q.creatorId) and.push({ creatorId: resolvePerson(q.creatorId, userId) });
  if (q.dueFrom || q.dueTo) {
    and.push({
      dueDate: { ...(q.dueFrom && { gte: q.dueFrom }), ...(q.dueTo && { lte: q.dueTo }) },
    });
  }
  if (q.overdue !== undefined) {
    const overdue = { dueDate: { lt: new Date() }, status: { not: 'COMPLETED' } };
    and.push(q.overdue ? overdue : { NOT: overdue });
  }
  if (q.q) {
    // Case-insensitive substring match (ILIKE) on title or description.
    and.push({
      OR: [
        { title: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
      ],
    });
  }
  return { AND: and };
}

function buildOrderBy({ sortBy, order }) {
  // Tasks without a due date go last whichever way you sort, which is what people expect.
  const primary =
    sortBy === 'dueDate' ? { dueDate: { sort: order, nulls: 'last' } } : { [sortBy]: order };
  // The id tie-breaker keeps pagination stable when many rows share the same sort value.
  return [primary, { id: 'asc' }];
}

export async function listTasks(userId, query) {
  const where = buildFilters(userId, query);
  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy: buildOrderBy(query),
      ...pageArgs(query),
    }),
    prisma.task.count({ where }),
  ]);
  return { data, meta: pageMeta(query, total) };
}
