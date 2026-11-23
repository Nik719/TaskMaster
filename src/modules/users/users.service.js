import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { profileSelect } from '../../utils/serializers.js';
import { hashPassword, revokeAllSessions, verifyPassword } from '../auth/auth.service.js';

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

export function updateProfile(userId, changes) {
  return prisma.user.update({ where: { id: userId }, data: changes, select: profileSelect });
}

/** Changes the password and signs out every other device. */
export async function changePassword(userId, sessionId, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await revokeAllSessions(userId, { except: sessionId });
}
