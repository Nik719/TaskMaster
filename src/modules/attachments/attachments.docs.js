import { errors, noContent, ok, pathParam, ref } from '../../config/openapiHelpers.js';

const tags = ['Attachments'];

export const attachmentsDocs = {
  tags: [{ name: 'Attachments', description: 'Files attached to a task' }],
  paths: {
    '/tasks/{taskId}/attachments': {
      parameters: [pathParam('taskId')],
      get: {
        tags,
        summary: 'List attachments',
        responses: {
          200: ok('Attachments', { type: 'array', items: ref('Attachment') }),
          ...errors(401, 404),
        },
      },
      post: {
        tags,
        summary: 'Upload a file (multipart/form-data, field "file")',
        description:
          'Allowed: images (PNG, JPEG, GIF, WebP), PDF, text/CSV/Markdown/JSON, Office ' +
          'documents and ZIP. Size limit: `MAX_UPLOAD_MB` (default 10 MB).',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          201: ok('Uploaded', ref('Attachment')),
          ...errors(400, 401, 404, 413),
          415: { description: 'File type not allowed' },
        },
      },
    },
    '/tasks/{taskId}/attachments/{attachmentId}/download': {
      parameters: [pathParam('taskId'), pathParam('attachmentId')],
      get: {
        tags,
        summary: 'Download a file',
        responses: {
          200: { description: 'The file, sent as a download' },
          ...errors(401, 404),
        },
      },
    },
    '/tasks/{taskId}/attachments/{attachmentId}': {
      parameters: [pathParam('taskId'), pathParam('attachmentId')],
      delete: {
        tags,
        summary: 'Delete an attachment (uploader, or project owner/admin)',
        responses: { 204: noContent('Deleted'), ...errors(401, 403, 404) },
      },
    },
  },
  schemas: {
    Attachment: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        taskId: { type: 'string', format: 'uuid' },
        originalName: { type: 'string' },
        mimeType: { type: 'string' },
        size: { type: 'integer', description: 'Bytes' },
        uploader: ref('UserSummary'),
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
};
