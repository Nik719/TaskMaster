import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as usersService from './users.service.js';

export async function getMe(req, res) {
  return sendSuccess(res, await usersService.getProfile(req.user.id));
}

export async function updateMe(req, res) {
  return sendSuccess(res, await usersService.updateProfile(req.user.id, req.validated.body));
}

export async function changePassword(req, res) {
  await usersService.changePassword(req.user.id, req.user.sessionId, req.validated.body);
  return sendNoContent(res);
}
