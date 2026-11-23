import {
  errors,
  ok,
  paginationParams,
  pathParam,
  queryParam,
  ref,
} from '../../config/openapiHelpers.js';

const tags = ['Notifications'];

export const notificationsDocs = {
  tags: [
    {
      name: 'Notifications',
      description:
        'Stored notifications. For live delivery connect with Socket.IO: ' +
        '`io(API_URL, { auth: { token: accessToken } })` and listen for `notification` ' +
        'and `notification:count`.',
    },
  ],
  paths: {
    '/notifications': {
      get: {
        tags,
        summary: 'My notifications (newest first)',
        description: '`meta.unread` always holds the total unread count.',
        parameters: [...paginationParams, queryParam('unread', { type: 'boolean' }, 'Only unread')],
        responses: {
          200: ok(
            'Notifications',
            { type: 'array', items: ref('Notification') },
            { paginated: true },
          ),
          ...errors(400, 401),
        },
      },
    },
    '/notifications/{notificationId}/read': {
      parameters: [pathParam('notificationId')],
      patch: {
        tags,
        summary: 'Mark one as read',
        responses: { 200: ok('Notification', ref('Notification')), ...errors(401, 404) },
      },
    },
    '/notifications/read-all': {
      post: {
        tags,
        summary: 'Mark all as read',
        responses: {
          200: ok('Count', { type: 'object', properties: { marked: { type: 'integer' } } }),
          ...errors(401),
        },
      },
    },
  },
  schemas: {
    Notification: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        type: {
          type: 'string',
          enum: [
            'TASK_ASSIGNED',
            'TASK_UPDATED',
            'TASK_COMPLETED',
            'TASK_COMMENTED',
            'PROJECT_INVITATION',
          ],
        },
        title: { type: 'string', example: 'Asha assigned you "Fix login bug"' },
        body: { type: 'string', nullable: true },
        taskId: { type: 'string', format: 'uuid', nullable: true },
        projectId: { type: 'string', format: 'uuid', nullable: true },
        actor: { allOf: [ref('UserSummary')], nullable: true },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};
