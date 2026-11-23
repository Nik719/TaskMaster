import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import * as c from './tasks.controller.js';
import { commentsRouter } from '../comments/comments.routes.js';
import { attachmentsRouter } from '../attachments/attachments.routes.js';
import { createTaskSchema, listTasksQuery, taskParams, updateTaskSchema } from './tasks.schemas.js';

export const tasksRouter = Router();

tasksRouter.use(authenticate);

tasksRouter
  .route('/')
  .post(validate({ body: createTaskSchema }), c.create)
  .get(validate({ query: listTasksQuery }), c.list);

tasksRouter
  .route('/:taskId')
  .get(validate({ params: taskParams }), c.get)
  .patch(validate({ params: taskParams, body: updateTaskSchema }), c.update)
  .delete(validate({ params: taskParams }), c.remove);

tasksRouter.use('/:taskId/comments', commentsRouter);
tasksRouter.use('/:taskId/attachments', attachmentsRouter);
