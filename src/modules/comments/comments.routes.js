// Mounted at /tasks/:taskId/comments (see tasks.routes.js).
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import * as c from './comments.controller.js';
import { commentBody, commentParams, listCommentsQuery, taskParams } from './comments.schemas.js';

// mergeParams exposes :taskId from the parent router.
export const commentsRouter = Router({ mergeParams: true });

commentsRouter
  .route('/')
  .get(validate({ params: taskParams, query: listCommentsQuery }), c.list)
  .post(validate({ params: taskParams, body: commentBody }), c.create);

commentsRouter
  .route('/:commentId')
  .patch(validate({ params: commentParams, body: commentBody }), c.update)
  .delete(validate({ params: commentParams }), c.remove);
