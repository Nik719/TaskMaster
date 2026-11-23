import { sendNoContent, sendSuccess } from '../../utils/response.js';
import { getAccessibleTask } from '../tasks/tasks.service.js';
import * as attachmentsService from './attachments.service.js';

/** Runs before the upload so files are never written for tasks the user can't access. */
export async function requireTaskAccess(req, _res, next) {
  req.taskAccess = await getAccessibleTask(req.validated.params.taskId, req.user.id);
  next();
}

export async function list(req, res) {
  return sendSuccess(
    res,
    await attachmentsService.listAttachments(req.validated.params.taskId, req.user.id),
  );
}

export async function upload(req, res) {
  const { attachment } = await attachmentsService.addAttachment(
    req.taskAccess.task,
    req.user.id,
    req.file,
  );
  return sendSuccess(res, attachment, { status: 201 });
}

export async function download(req, res) {
  const { taskId, attachmentId } = req.validated.params;
  const file = await attachmentsService.getDownload(taskId, attachmentId, req.user.id);
  // "attachment" makes browsers save the file instead of rendering it on our origin.
  res.attachment(file.originalName);
  res.type(file.mimeType);
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  return res.sendFile(file.path);
}

export async function remove(req, res) {
  const { taskId, attachmentId } = req.validated.params;
  await attachmentsService.deleteAttachment(taskId, attachmentId, req.user.id);
  return sendNoContent(res);
}
