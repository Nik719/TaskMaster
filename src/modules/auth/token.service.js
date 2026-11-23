// Access tokens (JWT) and refresh tokens.
//
// Access token: short-lived JWT, sent as "Authorization: Bearer <token>".
//   Payload: { sub: userId, sid: sessionId }.
// Refresh token: "<sessionId>.<random secret>", stored in an httpOnly cookie. Only a SHA-256
//   hash of the secret is kept in the database, and the secret changes on every refresh
//   (rotation). Presenting an old secret means the token was copied, so the whole session
//   is revoked (reuse detection).
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const ISSUER = 'taskmaster-api';
const ALGORITHM = 'HS256';

export const REFRESH_COOKIE = 'tm_refresh';
// The browser only sends the cookie to the auth routes, not on every API call.
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function signAccessToken(userId, sessionId) {
  return jwt.sign({ sid: sessionId }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    issuer: ISSUER,
    algorithm: ALGORITHM,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

/** Returns { userId, sessionId } or throws if the token is invalid or expired. */
export function verifyAccessToken(token) {
  // Pinning the algorithm blocks "alg: none" and algorithm-confusion attacks.
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    algorithms: [ALGORITHM],
  });
  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new jwt.JsonWebTokenError('malformed payload');
  }
  return { userId: payload.sub, sessionId: payload.sid };
}

/** Seconds until an access token expires; returned to clients so they can refresh early. */
export function accessTokenTtlSeconds(token) {
  const { exp } = jwt.decode(token);
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}

export function generateRefreshSecret() {
  return randomBytes(48).toString('base64url');
}

export function hashSecret(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

export function secretMatchesHash(secret, expectedHash) {
  const actual = Buffer.from(hashSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function buildRefreshToken(sessionId, secret) {
  return `${sessionId}.${secret}`;
}

/** Splits a refresh token into its parts, or returns null if it is malformed. */
export function parseRefreshToken(token) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
}

export function refreshExpiryDate() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function refreshCookieOptions(expires) {
  return {
    httpOnly: true, // not readable from JavaScript, so XSS can't steal it
    secure: env.isProduction, // HTTPS only in production
    sameSite: 'strict', // never sent on cross-site requests (CSRF protection)
    path: REFRESH_COOKIE_PATH,
    expires,
  };
}

export function clearRefreshCookieOptions() {
  const { expires: _expires, ...rest } = refreshCookieOptions();
  return rest;
}
