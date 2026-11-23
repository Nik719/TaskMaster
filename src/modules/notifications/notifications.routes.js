import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { idParams } from '../../utils/schemas.js';
import { paginationQuery } from '../../utils/pagination.js';
import * as c from './notifications.controller.js';

export const notificationsRouter = Router();

const listQuery = z.object({ ...paginationQuery, unread: z.stringbool().optional() });

notificationsRouter.use(authenticate);
notificationsRouter.get('/', validate({ query: listQuery }), c.list);
notificationsRouter.post('/read-all', c.markAllRead);
notificationsRouter.patch(
  '/:notificationId/read',
  validate({ params: idParams('notificationId') }),
  c.markRead,
);
