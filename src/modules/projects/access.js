// Membership-based access checks, shared by projects, tasks, comments and attachments.
//
// Rule of thumb: if the user may not even *see* a resource, answer 404 (so IDs from other
// teams can't be probed). If they can see it but their role is too low, answer 403.
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';

export const ROLES = Object.freeze({ OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' });
export const MANAGER_ROLES = [ROLES.OWNER, ROLES.ADMIN];

export function getMembership(projectId, userId) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { projectId: true, userId: true, role: true },
  });
}

/** Returns the caller's membership, or throws 404 if they are not in the project. */
export async function requireMember(projectId, userId) {
  const membership = await getMembership(projectId, userId);
  if (!membership) throw ApiError.notFound('Project not found');
  return membership;
}

/** Like requireMember, but also requires one of `roles` (403 otherwise). */
export async function requireRole(projectId, userId, roles, action = 'do this') {
  const membership = await requireMember(projectId, userId);
  if (!roles.includes(membership.role)) {
    throw ApiError.forbidden(`Only a project ${roles.join(' or ').toLowerCase()} can ${action}`);
  }
  return membership;
}

export const isManager = (role) => MANAGER_ROLES.includes(role);
