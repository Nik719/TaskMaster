// Requires a valid access token and an active session.
// On success, req.user = { id, sessionId } for the controllers.
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../modules/auth/token.service.js';

export function extractBearerToken(header) {
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Resolves an access token to its user, or throws a 401.
 * Shared by the HTTP middleware and the Socket.IO handshake.
 */
export async function resolveAccessToken(token) {
  if (!token) throw ApiError.unauthenticated();

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthenticated('Access token is invalid or expired');
  }

  // A signed token is not enough: the session must still exist and not be logged out.
  // This one indexed lookup is what makes logout immediate.
  const session = await prisma.session.findUnique({
    where: { id: claims.sessionId },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });
  if (
    !session ||
    session.userId !== claims.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  ) {
    throw ApiError.unauthenticated('Session has ended. Please log in again.');
  }

  return { id: claims.userId, sessionId: claims.sessionId };
}

export async function authenticate(req, _res, next) {
  req.user = await resolveAccessToken(extractBearerToken(req.headers.authorization));
  next();
}
