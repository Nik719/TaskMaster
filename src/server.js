// Process entry point: starts the HTTP server (REST + Socket.IO on one port) and shuts it
// down cleanly.
import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma, checkDatabase } from './config/prisma.js';
import { closeRealtime, initRealtime } from './realtime/socket.js';
import { sendInitialCount } from './modules/notifications/notifications.service.js';

async function start() {
  // Fail fast with a clear message if the database isn't reachable at startup.
  try {
    await checkDatabase();
  } catch (err) {
    // Log the short reason (e.g. "DatabaseNotReachable", "AuthenticationFailed"), not the full
    // Prisma error object, which is long and adds nothing the developer can act on.
    const reason = err.meta?.driverAdapterError?.cause?.kind ?? err.code ?? err.message;
    logger.fatal(
      { reason },
      'Cannot connect to the database. Is PostgreSQL running and DATABASE_URL correct?',
    );
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);
  initRealtime(server, { onConnect: sendInitialCount });
  server.listen(env.PORT, () => {
    logger.info(`TaskMaster API listening on http://localhost:${env.PORT} (docs: /api/docs)`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);

    // Stop accepting new connections; let in-flight requests finish, but not forever.
    const forceExit = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    // Socket.IO's close also closes the HTTP server it is attached to.
    await closeRealtime();
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});

start();
