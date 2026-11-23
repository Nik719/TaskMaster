import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as commentsService from './comments.service.js';

export async function list(req, res) {
  const { data, meta } = await commentsService.listComments(
    req.validated.params.taskId,
    req.user.id,
    req.validated.query,
  );
  return sendSuccess(res, data, { meta });
}

export async function create(req, res) {
  const { comment } = await commentsService.addComment(
    req.validated.params.taskId,
    req.user.id,
    req.validated.body.body,
  );
  return sendSuccess(res, comment, { status: 201 });
}

export async function update(req, res) {
  const { taskId, commentId } = req.validated.params;
  return sendSuccess(
    res,
    await commentsService.editComment(taskId, commentId, req.user.id, req.validated.body.body),
  );
}

export async function remove(req, res) {
  const { taskId, commentId } = req.validated.params;
  await commentsService.deleteComment(taskId, commentId, req.user.id);
  return sendNoContent(res);
}
