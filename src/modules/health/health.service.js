import { checkDatabase } from '../../config/prisma.js';

/** Reports whether the API and its database are usable. Never throws. */
export async function getHealth() {
  let database = 'up';
  try {
    await checkDatabase();
  } catch {
    database = 'down';
  }

  return {
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
