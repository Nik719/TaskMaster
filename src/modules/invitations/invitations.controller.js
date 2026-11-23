import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as invitationsService from './invitations.service.js';

export async function listMine(req, res) {
  return sendSuccess(res, await invitationsService.listMyInvitations(req.user.id));
}

export async function accept(req, res) {
  const membership = await invitationsService.acceptInvitation(
    req.validated.params.invitationId,
    req.user.id,
  );
  return sendSuccess(res, membership);
}

export async function decline(req, res) {
  await invitationsService.declineInvitation(req.validated.params.invitationId, req.user.id);
  return sendNoContent(res);
}
