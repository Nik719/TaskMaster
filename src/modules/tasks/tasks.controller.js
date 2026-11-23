import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as tasksService from './tasks.service.js';

export async function create(req, res) {
  const task = await tasksService.createTask(req.user.id, req.validated.body);
  return sendSuccess(res, task, { status: 201 });
}

export async function list(req, res) {
  const { data, meta } = await tasksService.listTasks(req.user.id, req.validated.query);
  return sendSuccess(res, data, { meta });
}

export async function get(req, res) {
  return sendSuccess(res, await tasksService.getTask(req.validated.params.taskId, req.user.id));
}

export async function update(req, res) {
  const { task } = await tasksService.updateTask(
    req.validated.params.taskId,
    req.user.id,
    req.validated.body,
  );
  return sendSuccess(res, task);
}

export async function remove(req, res) {
  await tasksService.deleteTask(req.validated.params.taskId, req.user.id);
  return sendNoContent(res);
}
