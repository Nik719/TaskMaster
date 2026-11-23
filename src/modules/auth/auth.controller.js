import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as authService from './auth.service.js';
import {
  REFRESH_COOKIE,
  clearRefreshCookieOptions,
  refreshCookieOptions,
} from './token.service.js';

function requestContext(req) {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

/**
 * The refresh token goes into an httpOnly cookie for browsers. It is also returned in the
 * body so non-browser clients (mobile apps, Postman, scripts) can store it themselves.
 */
function sendAuthResult(res, { user, tokens }, status = 200) {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(tokens.refreshExpiresAt));
  return sendSuccess(
    res,
    {
      ...(user && { user }),
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresIn,
      refreshToken: tokens.refreshToken,
    },
    { status },
  );
}

export async function register(req, res) {
  const result = await authService.register(req.validated.body, requestContext(req));
  return sendAuthResult(res, result, 201);
}

export async function login(req, res) {
  const result = await authService.login(req.validated.body, requestContext(req));
  return sendAuthResult(res, result);
}

export async function refresh(req, res) {
  // Cookie first (browsers); body as the fallback for other clients.
  const token = req.cookies?.[REFRESH_COOKIE] ?? req.validated.body.refreshToken;
  const tokens = await authService.refresh(token);
  return sendAuthResult(res, { tokens });
}

export async function logout(req, res) {
  await authService.logout(req.user.sessionId);
  res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
  return sendNoContent(res);
}

export async function logoutAll(req, res) {
  await authService.revokeAllSessions(req.user.id);
  res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
  return sendNoContent(res);
}
