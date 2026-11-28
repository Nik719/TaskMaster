import {
  errors,
  jsonBody,
  noContent,
  ok,
  paginationParams,
  pathParam,
  queryParam,
  ref,
} from '../../config/openapiHelpers.js';
import { SORT_FIELDS, TASK_PRIORITIES, TASK_STATUSES } from './tasks.schemas.js';

const tags = ['Tasks'];
const taskId = pathParam('taskId');

export const tasksDocs = {
  tags: [{ name: 'Tasks', description: 'Create, assign, complete, filter, sort and search tasks' }],
  paths: {
    '/tasks': {
      post: {
        tags,
        summary: 'Create a task',
        description:
          'With `projectId` the task belongs to that project (you must be a member, and the ' +
          'assignee must be one too). Without it, the task is personal: only you can see it.',
        requestBody: jsonBody(ref('TaskInput'), {
          title: 'Write release notes',
          description: 'Cover the new invite flow',
          dueDate: '2026-12-01',
          priority: 'HIGH',
          projectId: '3f1c2b4e-8d4a-4f0e-9b1a-6a7d2c9e5f10',
          assigneeId: '9b2e7c1d-2a4f-4e8b-8c3d-1f6a5b7c9d20',
        }),
        responses: { 201: ok('Created', ref('Task')), ...errors(400, 401, 404) },
      },
      get: {
        tags,
        summary: 'List tasks I can see (filter, sort, search, paginate)',
        description:
          'Examples: `?assigneeId=me` (my tasks), `?status=OPEN,IN_PROGRESS`, ' +
          '`?q=invoice&sortBy=dueDate&order=asc`, `?overdue=true`.',
        parameters: [
          ...paginationParams,
          queryParam('projectId', { type: 'string' }, 'A project ID, or `none` for personal tasks'),
          queryParam('status', { type: 'string' }, `Comma list of ${TASK_STATUSES.join(', ')}`),
          queryParam('priority', { type: 'string' }, `Comma list of ${TASK_PRIORITIES.join(', ')}`),
          queryParam('assigneeId', { type: 'string' }, '`me`, `none` or a user ID'),
          queryParam('creatorId', { type: 'string' }, '`me` or a user ID'),
          queryParam('dueFrom', { type: 'string', format: 'date' }),
          queryParam('dueTo', { type: 'string', format: 'date' }),
          queryParam('overdue', { type: 'boolean' }, 'Past due and not completed'),
          queryParam('q', { type: 'string' }, 'Search title and description (case-insensitive)'),
          queryParam('sortBy', { type: 'string', enum: SORT_FIELDS, default: 'createdAt' }),
          queryParam('order', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }),
        ],
        responses: {
          200: ok('Tasks', { type: 'array', items: ref('Task') }, { paginated: true }),
          ...errors(400, 401),
        },
      },
    },
    '/tasks/{taskId}': {
      parameters: [taskId],
      get: {
        tags,
        summary: 'Get a task',
        responses: { 200: ok('Task', ref('Task')), ...errors(401, 404) },
      },
      patch: {
        tags,
        summary: 'Update a task (edit, assign, complete)',
        description:
          'Mark complete with `{ "status": "COMPLETED" }` (sets `completedAt`). Assign with ' +
          '`{ "assigneeId": "<userId>" }`, unassign with `null`. The creator or a project ' +
          'owner/admin can change any field; the assignee can change only `status`. Other ' +
          'members get 403.',
        requestBody: jsonBody(ref('TaskUpdate'), { status: 'COMPLETED' }),
        responses: { 200: ok('Updated', ref('Task')), ...errors(400, 401, 403, 404) },
      },
      delete: {
        tags,
        summary: 'Delete a task (creator, or project owner/admin)',
        responses: { 204: noContent('Deleted'), ...errors(401, 403, 404) },
      },
    },
  },
  schemas: {
    TaskUpdate: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 200 },
        description: { type: 'string', maxLength: 10000, nullable: true },
        status: { type: 'string', enum: TASK_STATUSES },
        priority: { type: 'string', enum: TASK_PRIORITIES },
        dueDate: { type: 'string', format: 'date-time', nullable: true },
        assigneeId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
    TaskInput: {
      allOf: [
        ref('TaskUpdate'),
        {
          type: 'object',
          required: ['title'],
          properties: { projectId: { type: 'string', format: 'uuid' } },
        },
      ],
    },
    Task: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
        status: { type: 'string', enum: TASK_STATUSES },
        priority: { type: 'string', enum: TASK_PRIORITIES },
        dueDate: { type: 'string', format: 'date-time', nullable: true },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        project: {
          type: 'object',
          nullable: true,
          properties: { id: { type: 'string' }, name: { type: 'string' } },
        },
        creator: ref('UserSummary'),
        assignee: { allOf: [ref('UserSummary')], nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};
