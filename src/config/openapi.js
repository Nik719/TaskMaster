// Builds the OpenAPI 3 document served at /api/docs.
// The spec is written as plain JS objects (one *.docs.js file per module) instead of being
// generated from JSDoc comments: it's explicit, needs no extra library, and a typo is a
// normal JS error rather than a silently missing endpoint.
import { healthDocs } from '../modules/health/health.docs.js';

const moduleDocs = [healthDocs];

const errorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string' },
        details: {},
      },
      required: ['code', 'message'],
    },
  },
};

export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'TaskMaster API',
      version: '1.0.0',
      description:
        'Collaborative task tracking API. All endpoints return `{ success, data, meta? }` on success ' +
        'and `{ success: false, error: { code, message, details? } }` on failure.',
    },
    servers: [{ url: '/api/v1' }],
    tags: moduleDocs.flatMap((doc) => doc.tags ?? []),
    paths: Object.assign({}, ...moduleDocs.map((doc) => doc.paths ?? {})),
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: Object.assign(
        { ErrorResponse: errorResponseSchema },
        ...moduleDocs.map((doc) => doc.schemas ?? {}),
      ),
    },
    // Endpoints require a token unless they say otherwise (security: []).
    security: [{ bearerAuth: [] }],
  };
}
