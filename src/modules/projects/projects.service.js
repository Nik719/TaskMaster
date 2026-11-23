import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { publicUserSelect } from '../../utils/serializers.js';
import { pageArgs, pageMeta } from '../../utils/pagination.js';
import { MANAGER_ROLES, ROLES, requireMember, requireRole } from './access.js';
import { removeFiles } from '../../storage/localStorage.js';

const projectSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: publicUserSelect },
  _count: { select: { members: true, tasks: true } },
};

/** Flattens Prisma's _count into plain fields and adds the caller's role. */
function present(project, myRole) {
  const { _count, ...rest } = project;
  return { ...rest, memberCount: _count.members, taskCount: _count.tasks, myRole };
}

export async function createProject(userId, { name, description }) {
  // Creating the project and the owner's membership together keeps them consistent.
  const project = await prisma.project.create({
    data: {
      name,
      description,
      ownerId: userId,
      members: { create: { userId, role: ROLES.OWNER } },
    },
    select: projectSelect,
  });
  return present(project, ROLES.OWNER);
}

/** Projects the user belongs to, newest first. */
export async function listProjects(userId, query) {
  const where = {
    members: { some: { userId } },
    ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
  };
  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: { ...projectSelect, members: { where: { userId }, select: { role: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...pageArgs(query),
    }),
    prisma.project.count({ where }),
  ]);
  const data = rows.map(({ members, ...project }) => present(project, members[0]?.role));
  return { data, meta: pageMeta(query, total) };
}

export async function getProject(projectId, userId) {
  const { role } = await requireMember(projectId, userId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: projectSelect,
  });
  return present(project, role);
}

export async function updateProject(projectId, userId, changes) {
  const { role } = await requireRole(projectId, userId, MANAGER_ROLES, 'edit the project');
  const project = await prisma.project.update({
    where: { id: projectId },
    data: changes,
    select: projectSelect,
  });
  return present(project, role);
}

/** Deletes the project with everything in it. */
export async function deleteProject(projectId, userId) {
  await requireRole(projectId, userId, [ROLES.OWNER], 'delete the project');
  const files = await prisma.attachment.findMany({
    where: { task: { projectId } },
    select: { storageKey: true },
  });
  await prisma.project.delete({ where: { id: projectId } });
  await removeFiles(files.map((f) => f.storageKey));
}

// ── Members ──

export async function listMembers(projectId, userId) {
  await requireMember(projectId, userId);
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { role: true, joinedAt: true, user: { select: publicUserSelect } },
    // Enum order is OWNER, ADMIN, MEMBER, so this lists the owner first.
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  return members.map(({ user, ...m }) => ({ ...user, ...m }));
}

export async function updateMemberRole(projectId, actorId, targetUserId, role) {
  await requireRole(projectId, actorId, [ROLES.OWNER], "change members' roles");
  const target = await requireTarget(projectId, targetUserId);
  if (target.role === ROLES.OWNER) {
    throw ApiError.badRequest("The owner's role can't be changed");
  }
  const updated = await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    data: { role },
    select: { role: true, joinedAt: true, user: { select: publicUserSelect } },
  });
  return { ...updated.user, role: updated.role, joinedAt: updated.joinedAt };
}

/**
 * Removes a member, or lets a member leave (when actor === target).
 * Owner: can remove anyone but themself. Admin: can remove plain members. The owner can't leave.
 */
export async function removeMember(projectId, actorId, targetUserId) {
  const actor = await requireMember(projectId, actorId);
  const leaving = actorId === targetUserId;

  if (leaving) {
    if (actor.role === ROLES.OWNER) {
      throw ApiError.badRequest('The owner cannot leave the project. Delete it instead.');
    }
  } else {
    const target = await requireTarget(projectId, targetUserId);
    const allowed =
      (actor.role === ROLES.OWNER && target.role !== ROLES.OWNER) ||
      (actor.role === ROLES.ADMIN && target.role === ROLES.MEMBER);
    if (!allowed) throw ApiError.forbidden('You cannot remove this member');
  }

  // Tasks stay in the project, but assignments to the departed member are cleared so
  // nothing stays assigned to someone who can no longer see it.
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { projectId, assigneeId: targetUserId },
      data: { assigneeId: null },
    }),
    prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    }),
  ]);
}

async function requireTarget(projectId, userId) {
  const target = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!target) throw ApiError.notFound('Member not found');
  return target;
}
