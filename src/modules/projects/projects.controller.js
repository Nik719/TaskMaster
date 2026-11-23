import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as projectsService from './projects.service.js';
import * as invitationsService from '../invitations/invitations.service.js';

export async function create(req, res) {
  return sendSuccess(res, await projectsService.createProject(req.user.id, req.validated.body), {
    status: 201,
  });
}

export async function list(req, res) {
  const { data, meta } = await projectsService.listProjects(req.user.id, req.validated.query);
  return sendSuccess(res, data, { meta });
}

export async function get(req, res) {
  return sendSuccess(
    res,
    await projectsService.getProject(req.validated.params.projectId, req.user.id),
  );
}

export async function update(req, res) {
  const { projectId } = req.validated.params;
  return sendSuccess(
    res,
    await projectsService.updateProject(projectId, req.user.id, req.validated.body),
  );
}

export async function remove(req, res) {
  await projectsService.deleteProject(req.validated.params.projectId, req.user.id);
  return sendNoContent(res);
}

export async function listMembers(req, res) {
  return sendSuccess(
    res,
    await projectsService.listMembers(req.validated.params.projectId, req.user.id),
  );
}

export async function updateMember(req, res) {
  const { projectId, userId } = req.validated.params;
  return sendSuccess(
    res,
    await projectsService.updateMemberRole(projectId, req.user.id, userId, req.validated.body.role),
  );
}

export async function removeMember(req, res) {
  const { projectId, userId } = req.validated.params;
  await projectsService.removeMember(projectId, req.user.id, userId);
  return sendNoContent(res);
}

export async function invite(req, res) {
  const { projectId } = req.validated.params;
  const { invitation } = await invitationsService.createInvitation(
    projectId,
    req.user.id,
    req.validated.body,
  );
  return sendSuccess(res, invitation, { status: 201 });
}

export async function listInvitations(req, res) {
  const { projectId } = req.validated.params;
  return sendSuccess(
    res,
    await invitationsService.listProjectInvitations(projectId, req.user.id, req.validated.query),
  );
}

export async function revokeInvitation(req, res) {
  const { projectId, invitationId } = req.validated.params;
  await invitationsService.revokeInvitation(projectId, invitationId, req.user.id);
  return sendNoContent(res);
}
