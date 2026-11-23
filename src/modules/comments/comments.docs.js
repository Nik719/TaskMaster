import {
  errors,
  jsonBody,
  noContent,
  ok,
  paginationParams,
  pathParam,
  ref,
} from '../../config/openapiHelpers.js';

const tags = ['Comments'];
const body = jsonBody(
  { type: 'object', required: ['body'], properties: { body: { type: 'string', maxLength: 5000 } } },
  { body: 'I pushed a fix, can someone review?' },
);

export const commentsDocs = {
  tags: [{ name: 'Comments', description: 'Discussion on a task' }],
  paths: {
    '/tasks/{taskId}/comments': {
      parameters: [pathParam('taskId')],
      get: {
        tags,
        summary: 'List comments (oldest first)',
        parameters: paginationParams,
        responses: {
          200: ok('Comments', { type: 'array', items: ref('Comment') }, { paginated: true }),
          ...errors(401, 404),
        },
      },
      post: {
        tags,
        summary: 'Add a comment',
        requestBody: body,
        responses: { 201: ok('Created', ref('Comment')), ...errors(400, 401, 404) },
      },
    },
    '/tasks/{taskId}/comments/{commentId}': {
      parameters: [pathParam('taskId'), pathParam('commentId')],
      patch: {
        tags,
        summary: 'Edit my comment',
        requestBody: body,
        responses: { 200: ok('Updated', ref('Comment')), ...errors(400, 401, 403, 404) },
      },
      delete: {
        tags,
        summary: 'Delete a comment (author, or project owner/admin)',
        responses: { 204: noContent('Deleted'), ...errors(401, 403, 404) },
      },
    },
  },
  schemas: {
    Comment: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        taskId: { type: 'string', format: 'uuid' },
        body: { type: 'string' },
        author: ref('UserSummary'),
        editedAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};
