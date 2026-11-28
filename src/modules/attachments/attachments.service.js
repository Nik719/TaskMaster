import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { publicUserSelect } from '../../utils/serializers.js';
import { pathFor, removeFiles } from '../../storage/localStorage.js';
import { isManager } from '../projects/access.js';
import { getAccessibleTask } from '../tasks/tasks.service.js';
import * as taskEvents from '../notifications/taskEvents.js';
import { withNotifications } from '../notifications/notifications.service.js';

const attachmentSelect = {
  id: true,
  taskId: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  uploader: { select: publicUserSelect },
};

export async function listAttachments(taskId, userId) {
  await getAccessibleTask(taskId, userId);
  return prisma.attachment.findMany({
    where: { taskId },
    select: attachmentSelect,
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Records an uploaded file. The route checks task access *before* multer writes anything,
 * but if saving the record fails the file is removed so no orphans are left on disk.
 */
export async function addAttachment(task, userId, file) {
  let attachment;
  try {
    attachment = await withNotifications(async (tx, outbox) => {
      const created = await tx.attachment.create({
        data: {
          taskId: task.id,
          uploaderId: userId,
          originalName: file.originalname.replace(/[\\/\0]/g, '_').slice(0, 255),
          storageKey: file.filename,
          mimeType: file.mimetype,
          size: file.size,
        },
        select: attachmentSelect,
      });
      outbox.push(...(await taskEvents.attachmentAdded(tx, userId, task, created)));
      return created;
    });
  } catch (err) {
    // Covers a failed notification too: the transaction rolled back, so drop the file.
    await removeFiles([file.filename]);
    throw err;
  }
  return { attachment, task };
}

async function findAttachment(taskId, attachmentId) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, taskId },
    select: { id: true, uploaderId: true, storageKey: true, originalName: true, mimeType: true },
  });
  if (!attachment) throw ApiError.notFound('Attachment not found');
  return attachment;
}

/** Returns what the controller needs to stream the file. */
export async function getDownload(taskId, attachmentId, userId) {
  await getAccessibleTask(taskId, userId);
  const attachment = await findAttachment(taskId, attachmentId);
  return { ...attachment, path: pathFor(attachment.storageKey) };
}

export async function deleteAttachment(taskId, attachmentId, userId) {
  const { role } = await getAccessibleTask(taskId, userId);
  const attachment = await findAttachment(taskId, attachmentId);
  if (attachment.uploaderId !== userId && !isManager(role)) {
    throw ApiError.forbidden('You can only delete files you uploaded');
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await removeFiles([attachment.storageKey]);
}
