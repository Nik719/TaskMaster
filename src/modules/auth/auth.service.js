import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { profileSelect } from '../../utils/serializers.js';
import { disconnectSession, disconnectUser } from '../../realtime/socket.js';
import {
  buildRefreshToken,
  generateRefreshSecret,
  hashSecret,
  parseRefreshToken,
  refreshExpiryDate,
  secretMatchesHash,
  signAccessToken,
  accessTokenTtlSeconds,
} from './token.service.js';

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_REFRESH = 'Refresh token is invalid or expired. Please log in again.';

// Compared against when the email doesn't exist, so a login for an unknown email takes as
// long as one with a wrong password. Otherwise response time would reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', 10);

export function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/** Creates a session and returns the tokens the client needs. */
async function startSession(userId, context) {
  const secret = generateRefreshSecret();
  const expiresAt = refreshExpiryDate();
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hashSecret(secret),
      userAgent: context.userAgent?.slice(0, 512),
      ip: context.ip?.slice(0, 64),
      expiresAt,
    },
    select: { id: true },
  });
  return issueTokens(userId, session.id, secret, expiresAt);
}

function issueTokens(userId, sessionId, secret, refreshExpiresAt) {
  const accessToken = signAccessToken(userId, sessionId);
  return {
    accessToken,
    expiresIn: accessTokenTtlSeconds(accessToken),
    refreshToken: buildRefreshToken(sessionId, secret),
    refreshExpiresAt,
  };
}

export async function register({ name, email, password }, context) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
    select: profileSelect,
  });
  const tokens = await startSession(user.id, context);
  return { user, tokens };
}

export async function login({ email, password }, context) {
  const record = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  const passwordOk = await verifyPassword(password, record?.passwordHash ?? DUMMY_HASH);
  if (!record || !passwordOk) throw ApiError.unauthenticated(INVALID_CREDENTIALS);

  const user = await prisma.user.findUnique({ where: { id: record.id }, select: profileSelect });
  const tokens = await startSession(user.id, context);
  return { user, tokens };
}

/** Swaps a valid refresh token for a new access token and a new (rotated) refresh token. */
export async function refresh(rawToken) {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) throw ApiError.unauthenticated(INVALID_REFRESH);

  const session = await prisma.session
    .findUnique({ where: { id: parsed.sessionId } })
    .catch(() => null); // a malformed UUID makes Postgres throw; treat it as "not found"
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw ApiError.unauthenticated(INVALID_REFRESH);
  }

  if (!secretMatchesHash(parsed.secret, session.refreshTokenHash)) {
    // A correct session ID with an old secret means a rotated-out token was replayed:
    // someone may have stolen it. End the session so neither copy keeps working.
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    throw ApiError.unauthenticated(INVALID_REFRESH);
  }

  const secret = generateRefreshSecret();
  const expiresAt = refreshExpiryDate();
  // The WHERE on the old hash makes rotation atomic: if two refreshes race with the same
  // token, only one of them updates the row.
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenHash: session.refreshTokenHash, revokedAt: null },
    data: { refreshTokenHash: hashSecret(secret), expiresAt, lastUsedAt: new Date() },
  });
  if (count === 0) throw ApiError.unauthenticated(INVALID_REFRESH);

  return issueTokens(session.userId, session.id, secret, expiresAt);
}

export async function logout(sessionId) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  // Open WebSocket connections of this device end too.
  disconnectSession(sessionId);
}

/** Ends every session of the user except (optionally) one. */
export async function revokeAllSessions(userId, { except } = {}) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(except && { id: { not: except } }) },
    data: { revokedAt: new Date() },
  });
  disconnectUser(userId, { exceptSessionId: except });
}
