// OpenAPI description of the health module. Each module keeps its docs next to its code.
export const healthDocs = {
  tags: [{ name: 'Health', description: 'Service status' }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API and database status',
        security: [],
        responses: {
          200: {
            description: 'API and database are up',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
                example: {
                  success: true,
                  data: {
                    status: 'ok',
                    database: 'up',
                    uptimeSeconds: 42,
                    timestamp: '2026-11-23T10:00:00.000Z',
                  },
                },
              },
            },
          },
          503: {
            description: 'Database is unreachable',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } },
            },
          },
        },
      },
    },
  },
  schemas: {
    HealthResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded'] },
            database: { type: 'string', enum: ['up', 'down'] },
            uptimeSeconds: { type: 'integer' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
};
