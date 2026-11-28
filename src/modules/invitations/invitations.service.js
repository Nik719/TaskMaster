// Project invitations: owners/admins invite by email; the invitee accepts (joins) or declines.
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { publicUserSelect } from '../../utils/serializers.js';
import { MANAGER_ROLES, ROLES, requireRole } from '../projects/access.js';
import * as taskEvents from '../notifications/taskEvents.js';
import { withNotifications } from '../notifications/notifications.service.js';

const INVITATION_TTL_DAYS = 7;

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  respondedAt: true,
  createdAt: true,
  project: { select: { id: true, name: true } },
  invitedBy: { select: publicUserSelect },
};

export async function createInvitation(projectId, actorId, { email, role }) {
  const actor = await requireRole(projectId, actorId, MANAGER_ROLES, 'invite people');
  if (role === ROLES.ADMIN && actor.role !== ROLES.OWNER) {
    throw ApiError.forbidden('Only the project owner can invite admins');
  }

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const alreadyMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: existingUser.id } },
      select: { userId: true },
    });
    if (alreadyMember) throw ApiError.conflict('This person is already a member of the project');
  }

  const invitation = await withNotifications(async (tx, outbox) => {
    // Check-then-insert is only safe if concurrent invites for the same project and email
    // run one at a time. A transaction-scoped advisory lock serializes exactly those requests
    // (it is released on commit/rollback); a plain unique index can't express "one PENDING,
    // unexpired invitation" because expiry is time-based.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation:${projectId}:${email}`}, 0))`;

    const pending = await tx.projectInvitation.findFirst({
      where: { projectId, email, status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pending) throw ApiError.conflict('A pending invitation for this email already exists');

    const created = await tx.projectInvitation.create({
      data: {
        projectId,
        email,
        role,
        invitedById: actorId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
      select: invitationSelect,
    });
    // People without an account yet see the invitation via GET /invitations after signing up.
    if (existingUser) {
      outbox.push(...(await taskEvents.invited(tx, actorId, existingUser.id, created)));
    }
    return created;
  });
  return { invitation, inviteeId: existingUser?.id ?? null };
}

export async function listProjectInvitations(projectId, actorId, { status }) {
  await requireRole(projectId, actorId, MANAGER_ROLES, 'view invitations');
  return prisma.projectInvitation.findMany({
    where: { projectId, ...(status && { status }) },
    select: invitationSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeInvitation(projectId, invitationId, actorId) {
  await requireRole(projectId, actorId, MANAGER_ROLES, 'revoke invitations');
  const { count } = await prisma.projectInvitation.updateMany({
    where: { id: invitationId, projectId, status: 'PENDING' },
    data: { status: 'REVOKED', respondedAt: new Date() },
  });
  if (count === 0) throw ApiError.notFound('Pending invitation not found');
}

/** Pending, unexpired invitations addressed to the signed-in user's email. */
export async function listMyInvitations(userId) {
  const { email } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  return prisma.projectInvitation.findMany({
    where: { email, status: 'PENDING', expiresAt: { gt: new Date() } },
    select: invitationSelect,
    orderBy: { createdAt: 'desc' },
  });
}

async function findMyPendingInvitation(invitationId, userId) {
  const { email } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  const invitation = await prisma.projectInvitation.findFirst({
    where: { id: invitationId, email, status: 'PENDING', expiresAt: { gt: new Date() } },
    select: { id: true, projectId: true, role: true },
  });
  // Someone else's invitation looks exactly like a missing one.
  if (!invitation) throw ApiError.notFound('Invitation not found or no longer valid');
  return invitation;
}

/** Joins the project. Returns the membership. */
export async function acceptInvitation(invitationId, userId) {
  const invitation = await findMyPendingInvitation(invitationId, userId);

  const [membership] = await prisma.$transaction([
    // upsert: if they somehow joined already (e.g. via a second invite), keep the existing row.
    prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: invitation.projectId, userId } },
      create: { projectId: invitation.projectId, userId, role: invitation.role },
      update: {},
      select: { role: true, joinedAt: true, project: { select: { id: true, name: true } } },
    }),
    prisma.projectInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    }),
  ]);
  return membership;
}

export async function declineInvitation(invitationId, userId) {
  const invitation = await findMyPendingInvitation(invitationId, userId);
  await prisma.projectInvitation.update({
    where: { id: invitation.id },
    data: { status: 'DECLINED', respondedAt: new Date() },
  });
}
