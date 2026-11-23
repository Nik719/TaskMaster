// Mounted at /tasks/:taskId/attachments (see tasks.routes.js).
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { uploadSingleFile } from '../../middleware/upload.js';
import { idParams } from '../../utils/schemas.js';
import * as c from './attachments.controller.js';

export const attachmentsRouter = Router({ mergeParams: true });

const taskParams = idParams('taskId');
const attachmentParams = idParams('taskId', 'attachmentId');

attachmentsRouter
  .route('/')
  .get(validate({ params: taskParams }), c.list)
  .post(validate({ params: taskParams }), c.requireTaskAccess, uploadSingleFile, c.upload);

attachmentsRouter.get(
  '/:attachmentId/download',
  validate({ params: attachmentParams }),
  c.download,
);
attachmentsRouter.delete('/:attachmentId', validate({ params: attachmentParams }), c.remove);
