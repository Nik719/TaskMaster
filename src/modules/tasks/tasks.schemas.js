import { z } from 'zod';
import { csvEnum, idParams, optionalText, uuid } from '../../utils/schemas.js';
import { paginationQuery } from '../../utils/pagination.js';

export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED'];
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title', 'status'];

export const taskParams = idParams('taskId');

// Accepts a full ISO timestamp ("2026-12-01T17:00:00Z") or a plain date ("2026-12-01").
const isoDate = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()], {
    error: 'Must be an ISO 8601 date, e.g. 2026-12-01 or 2026-12-01T17:00:00Z',
  })
  .transform((value) => new Date(value));

const title = z.string().trim().min(1, 'Title is required').max(200);

export const createTaskSchema = z.object({
  title,
  description: optionalText(10000),
  status: z.enum(TASK_STATUSES).default('OPEN'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  dueDate: isoDate.nullable().optional(),
  // Omit for a personal task.
  projectId: uuid.optional(),
  assigneeId: uuid.nullable().optional(),
});

// The project can't change after creation: moving a task would silently change who can see it.
export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: optionalText(10000),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: isoDate.nullable().optional(),
    assigneeId: uuid.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

// "me" and "none" are shortcuts so clients don't need to know their own ID.
const personFilter = z.union([z.literal('me'), z.literal('none'), uuid]);

export const listTasksQuery = z
  .object({
    ...paginationQuery,
    projectId: z.union([uuid, z.literal('none')]).optional(),
    status: csvEnum(TASK_STATUSES).optional(),
    priority: csvEnum(TASK_PRIORITIES).optional(),
    assigneeId: personFilter.optional(),
    creatorId: z.union([z.literal('me'), uuid]).optional(),
    dueFrom: isoDate.optional(),
    dueTo: isoDate.optional(),
    overdue: z.stringbool().optional(),
    q: z.string().trim().min(1).max(200).optional(),
    sortBy: z.enum(SORT_FIELDS).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((q) => !(q.dueFrom && q.dueTo) || q.dueFrom <= q.dueTo, {
    message: 'dueFrom must be on or before dueTo',
    path: ['dueFrom'],
  });
