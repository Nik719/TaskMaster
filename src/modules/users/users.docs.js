import { errors, jsonBody, noContent, ok, ref } from '../../config/openapiHelpers.js';

export const usersDocs = {
  tags: [{ name: 'Users', description: 'Your profile' }],
  paths: {
    '/users/me': {
      get: {
        tags: ['Users'],
        summary: 'View my profile',
        responses: { 200: ok('Profile', ref('Profile')), ...errors(401) },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update my profile',
        requestBody: jsonBody(ref('UpdateProfileInput'), { name: 'Asha R.', bio: 'Backend dev' }),
        responses: { 200: ok('Updated profile', ref('Profile')), ...errors(400, 401) },
      },
    },
    '/users/me/password': {
      patch: {
        tags: ['Users'],
        summary: 'Change my password',
        description: 'Also signs out every other device.',
        requestBody: jsonBody(ref('ChangePasswordInput')),
        responses: { 204: noContent('Password changed'), ...errors(400, 401) },
      },
    },
  },
  schemas: {
    UserSummary: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        avatarUrl: { type: 'string', nullable: true },
      },
    },
    Profile: {
      allOf: [
        ref('UserSummary'),
        {
          type: 'object',
          properties: {
            bio: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      ],
    },
    UpdateProfileInput: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 100 },
        bio: { type: 'string', maxLength: 500, nullable: true },
        avatarUrl: { type: 'string', format: 'uri', nullable: true },
      },
    },
    ChangePasswordInput: {
      type: 'object',
      required: ['currentPassword', 'newPassword'],
      properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } },
    },
  },
};
