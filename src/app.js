// Builds the Express application. It does NOT start listening: server.js does that.
// Keeping the two apart lets the tests import the app and call it with Supertest
// without opening a real network port.
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { buildOpenApiSpec } from './config/openapi.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ApiError } from './utils/ApiError.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Requests without an Origin header (curl, Postman, server-to-server) aren't
        // subject to CORS at all, so they're allowed through.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(ApiError.forbidden(`Origin ${origin} is not allowed`, 'CORS_NOT_ALLOWED'));
      },
      credentials: true, // needed for the httpOnly refresh-token cookie (Phase 3)
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const openApiSpec = buildOpenApiSpec();
  app.get('/api/docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
