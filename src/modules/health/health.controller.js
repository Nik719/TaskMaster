import { sendSuccess } from '../../utils/response.js';
import * as healthService from './health.service.js';

export async function getHealth(_req, res) {
  const health = await healthService.getHealth();
  // 503 lets load balancers and Docker take an instance out of rotation when the DB is unreachable.
  return sendSuccess(res, health, { status: health.database === 'up' ? 200 : 503 });
}
