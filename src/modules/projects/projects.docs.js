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

const tags = ['Projects'];
const projectId = pathParam('projectId');

export const projectsDocs = {
  tags: [
    { name: 'Projects', description: 'Teams/projects, members and sending invitations' },
    { name: 'Invitations', description: 'Invitations addressed to me' },
  ],
  paths: {
    '/projects': {
      post: {
        tags,
        summary: 'Create a project (you become its owner)',
        requestBody: jsonBody(ref('ProjectInput'), {
          name: 'Website relaunch',
          description: 'Q1 redesign',
        }),
        responses: { 201: ok('Created', ref('Project')), ...errors(400, 401) },
      },
      get: {
        tags,
        summary: 'List projects I belong to',
        parameters: [...paginationParams, queryParam('q', { type: 'string' }, 'Search by name')],
        responses: {
          200: ok('Projects', { type: 'array', items: ref('Project') }, { paginated: true }),
          ...errors(400, 401),
        },
      },
    },
    '/projects/{projectId}': {
      parameters: [projectId],
      get: {
        tags,
        summary: 'Get a project',
        responses: { 200: ok('Project', ref('Project')), ...errors(401, 404) },
      },
      patch: {
        tags,
        summary: 'Update a project (owner/admin)',
        requestBody: jsonBody(ref('ProjectInput')),
        responses: { 200: ok('Updated', ref('Project')), ...errors(400, 401, 403, 404) },
      },
      delete: {
        tags,
        summary: 'Delete a project and everything in it (owner)',
        responses: { 204: noContent('Deleted'), ...errors(401, 403, 404) },
      },
    },
    '/projects/{projectId}/members': {
      parameters: [projectId],
      get: {
        tags,
        summary: 'List members',
        responses: {
          200: ok('Members', { type: 'array', items: ref('Member') }),
          ...errors(401, 404),
        },
      },
    },
    '/projects/{projectId}/members/{userId}': {
      parameters: [projectId, pathParam('userId')],
      patch: {
        tags,
        summary: "Change a member's role (owner)",
        requestBody: jsonBody(
          { type: 'object', properties: { role: { type: 'string', enum: ['ADMIN', 'MEMBER'] } } },
          { role: 'ADMIN' },
        ),
        responses: { 200: ok('Updated member', ref('Member')), ...errors(400, 401, 403, 404) },
      },
      delete: {
        tags,
        summary: 'Remove a member, or leave (use your own user ID)',
        description:
          'Owner can remove anyone except themself; admins can remove plain members. The owner ' +
          "can't leave. The member's task assignments in this project are cleared.",
        responses: { 204: noContent('Removed'), ...errors(400, 401, 403, 404) },
      },
    },
    '/projects/{projectId}/invitations': {
      parameters: [projectId],
      post: {
        tags,
        summary: 'Invite someone by email (owner/admin)',
        description:
          'The email does not need an account yet; the invitation waits until that person signs ' +
          'up. Only the owner can invite as ADMIN. Invitations expire after 7 days.',
        requestBody: jsonBody(ref('InvitationInput'), {
          email: 'ravi@example.com',
          role: 'MEMBER',
        }),
        responses: { 201: ok('Invitation', ref('Invitation')), ...errors(400, 401, 403, 404, 409) },
      },
      get: {
        tags,
        summary: "List the project's invitations (owner/admin)",
        parameters: [
          queryParam('status', {
            type: 'string',
            enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED'],
          }),
        ],
        responses: {
          200: ok('Invitations', { type: 'array', items: ref('Invitation') }),
          ...errors(401, 403, 404),
        },
      },
    },
    '/projects/{projectId}/invitations/{invitationId}': {
      parameters: [projectId, pathParam('invitationId')],
      delete: {
        tags,
        summary: 'Revoke a pending invitation (owner/admin)',
        responses: { 204: noContent('Revoked'), ...errors(401, 403, 404) },
      },
    },
    '/invitations': {
      get: {
        tags: ['Invitations'],
        summary: 'My pending invitations',
        responses: {
          200: ok('Invitations', { type: 'array', items: ref('Invitation') }),
          ...errors(401),
        },
      },
    },
    '/invitations/{invitationId}/accept': {
      parameters: [pathParam('invitationId')],
      post: {
        tags: ['Invitations'],
        summary: 'Accept an invitation (join the project)',
        responses: { 200: ok('Membership', { type: 'object' }), ...errors(401, 404) },
      },
    },
    '/invitations/{invitationId}/decline': {
      parameters: [pathParam('invitationId')],
      post: {
        tags: ['Invitations'],
        summary: 'Decline an invitation',
        responses: { 204: noContent('Declined'), ...errors(401, 404) },
      },
    },
  },
  schemas: {
    ProjectInput: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', maxLength: 120 },
        description: { type: 'string', maxLength: 2000, nullable: true },
      },
    },
    Project: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        description: { type: 'string', nullable: true },
        owner: ref('UserSummary'),
        memberCount: { type: 'integer' },
        myRole: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    Member: {
      allOf: [
        ref('UserSummary'),
        {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
            joinedAt: { type: 'string', format: 'date-time' },
          },
        },
      ],
    },
    InvitationInput: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
      },
    },
    Invitation: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string' },
        role: { type: 'string', enum: ['ADMIN', 'MEMBER'] },
        status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED'] },
        expiresAt: { type: 'string', format: 'date-time' },
        project: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' } },
        },
        invitedBy: ref('UserSummary'),
      },
    },
  },
};
