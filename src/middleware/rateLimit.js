// Rate limiters for endpoints that are attractive to abuse.
// Counters live in memory, which is fine for a single instance. With several instances,
// plug a shared store (e.g. rate-limit-redis) into express-rate-limit.
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Tests hit these endpoints far more often than a human would.
    skip: () => env.isTest,
    handler: (_req, _res, next) => next(ApiError.tooManyRequests(message)),
  });
}

/** Login / register / refresh: slows down password guessing. */
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many authentication attempts. Please wait 15 minutes and try again.',
});
