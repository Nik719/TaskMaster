// Socket.IO server for real-time notifications.
//
// Clients connect with the same access token they use for HTTP:
//   io('http://localhost:4000', { auth: { token: accessToken } })
// Each socket joins two rooms: "user:<id>" (everything for that user) and
// "session:<id>" (so logging out can disconnect exactly that device).
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { extractBearerToken, resolveAccessToken } from '../middleware/authenticate.js';

let io = null;

export const userRoom = (userId) => `user:${userId}`;
export const sessionRoom = (sessionId) => `session:${sessionId}`;

export function initRealtime(httpServer, { onConnect } = {}) {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  // Runs once per connection, before "connection" fires. Same checks as HTTP requests.
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ?? extractBearerToken(socket.handshake.headers.authorization);
      socket.data.user = await resolveAccessToken(token);
      next();
    } catch (err) {
      next(new Error(err.message ?? 'Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const { id, sessionId } = socket.data.user;
    socket.join([userRoom(id), sessionRoom(sessionId)]);
    logger.debug({ userId: id }, 'Socket connected');
    try {
      await onConnect?.(socket);
    } catch (err) {
      logger.warn({ err }, 'Socket onConnect hook failed');
    }
  });

  return io;
}

/** Sends an event to every open connection of a user. A no-op when realtime isn't running (tests, scripts). */
export function emitToUser(userId, event, payload) {
  io?.to(userRoom(userId)).emit(event, payload);
}

/** Disconnects the sockets of one session (logout). */
export function disconnectSession(sessionId) {
  io?.in(sessionRoom(sessionId)).disconnectSockets(true);
}

/** Disconnects all of a user's sockets, optionally keeping one session (password change). */
export function disconnectUser(userId, { exceptSessionId } = {}) {
  if (!io) return;
  const target = io.in(userRoom(userId));
  (exceptSessionId ? target.except(sessionRoom(exceptSessionId)) : target).disconnectSockets(true);
}

export async function closeRealtime() {
  if (io) await io.close();
  io = null;
}
