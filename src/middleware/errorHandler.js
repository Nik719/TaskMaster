// Central error handler: the only place that turns errors into HTTP responses.
// Express 5 forwards errors thrown in async route handlers here automatically,
// so controllers don't need try/catch.
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

/** Converts known error types into an ApiError. Returns null for unexpected errors. */
export function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.validation(
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  // Errors raised by Express's body parser (express.json()).
  if (err?.type === 'entity.parse.failed') {
    return new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  // Prisma errors that represent client mistakes rather than server bugs.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // unique constraint violated
        return ApiError.conflict('A record with the same unique value already exists');
      case 'P2025': // record required for the operation was not found
        return ApiError.notFound();
      default:
        return null;
    }
  }

  return null;
}

// Express recognises error middleware by its four arguments, so `_next` must stay.
export function errorHandler(err, req, res, _next) {
  const apiError = toApiError(err);

  if (apiError) {
    if (apiError.statusCode >= 500) req.log?.error({ err }, apiError.message);
    const error = { code: apiError.code, message: apiError.message };
    if (apiError.details !== undefined) error.details = apiError.details;
    return res.status(apiError.statusCode).json({ success: false, error });
  }

  // Unexpected error: log everything, reveal nothing.
  (req.log ?? logger).error({ err }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again later.' },
  });
}
