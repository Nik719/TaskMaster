// Small builders that keep the per-module *.docs.js files short and consistent.

export const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

/** A JSON request body. */
export const jsonBody = (schema, example) => ({
  required: true,
  content: { 'application/json': { schema, ...(example && { example }) } },
});

/** A success response wrapped in the standard { success, data, meta? } envelope. */
export const ok = (description, dataSchema, { paginated = false } = {}) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: dataSchema,
          ...(paginated && { meta: ref('PaginationMeta') }),
        },
      },
    },
  },
});

export const noContent = (description = 'Done (no body)') => ({ description });

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: ref('ErrorResponse') } },
});

/** Standard error responses, picked by status code. */
export const errors = (...codes) =>
  Object.fromEntries(
    codes.map((code) => [
      code,
      errorResponse(
        {
          400: 'Validation failed',
          401: 'Missing, invalid or expired access token',
          403: 'Not allowed',
          404: 'Not found (or not visible to you)',
          409: 'Conflict with existing data',
          413: 'Payload too large',
          429: 'Rate limited',
          502: 'Upstream AI provider failed',
          503: 'Feature not configured',
        }[code],
      ),
    ]),
  );

export const pathParam = (name, description = `${name} (UUID)`) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});

export const queryParam = (name, schema, description) => ({
  name,
  in: 'query',
  required: false,
  schema,
  ...(description && { description }),
});

export const paginationParams = [
  queryParam('page', { type: 'integer', minimum: 1, default: 1 }),
  queryParam('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
];
