import { errors, jsonBody, noContent, ok, ref } from '../../config/openapiHelpers.js';

const authResult = ok('Signed in', ref('AuthResult'));

export const authDocs = {
  tags: [{ name: 'Auth', description: 'Register, log in, refresh and log out' }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account (and sign in)',
        security: [],
        requestBody: jsonBody(ref('RegisterInput'), {
          name: 'Asha Rao',
          email: 'asha@example.com',
          password: 'Passw0rd!',
        }),
        responses: { 201: authResult, ...errors(400, 409, 429) },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        security: [],
        requestBody: jsonBody(ref('LoginInput'), {
          email: 'asha@example.com',
          password: 'Passw0rd!',
        }),
        responses: { 200: authResult, ...errors(400, 401, 429) },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Get a new access token',
        description:
          'Reads the refresh token from the `tm_refresh` httpOnly cookie, or from the body for ' +
          'non-browser clients. The refresh token is rotated on every call; replaying an old ' +
          'one ends the session.',
        security: [],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { refreshToken: { type: 'string' } } },
            },
          },
        },
        responses: { 200: ok('New tokens', ref('AuthResult')), ...errors(401, 429) },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out this device',
        description:
          'Ends the current session. Its access and refresh tokens stop working at once.',
        responses: { 204: noContent('Logged out'), ...errors(401) },
      },
    },
    '/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Log out every device',
        responses: { 204: noContent('All sessions ended'), ...errors(401) },
      },
    },
  },
  schemas: {
    RegisterInput: {
      type: 'object',
      required: ['name', 'email', 'password'],
      properties: {
        name: { type: 'string', maxLength: 100 },
        email: { type: 'string', format: 'email' },
        password: {
          type: 'string',
          minLength: 8,
          maxLength: 72,
          description: 'At least one letter and one number',
        },
      },
    },
    LoginInput: {
      type: 'object',
      required: ['email', 'password'],
      properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
    },
    AuthResult: {
      type: 'object',
      properties: {
        user: ref('Profile'),
        accessToken: { type: 'string' },
        tokenType: { type: 'string', example: 'Bearer' },
        expiresIn: { type: 'integer', description: 'Seconds until the access token expires' },
        refreshToken: { type: 'string' },
      },
    },
  },
};
