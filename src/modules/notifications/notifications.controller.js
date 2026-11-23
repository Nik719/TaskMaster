import { sendSuccess } from '../../utils/response.js';
import * as notificationsService from './notifications.service.js';

export async function list(req, res) {
  const { data, meta } = await notificationsService.listNotifications(
    req.user.id,
    req.validated.query,
  );
  return sendSuccess(res, data, { meta });
}

export async function markRead(req, res) {
  return sendSuccess(
    res,
    await notificationsService.markRead(req.validated.params.notificationId, req.user.id),
  );
}

export async function markAllRead(req, res) {
  return sendSuccess(res, await notificationsService.markAllRead(req.user.id));
}
