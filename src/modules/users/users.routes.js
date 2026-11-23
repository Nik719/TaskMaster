import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import * as usersController from './users.controller.js';
import { changePasswordSchema, updateProfileSchema } from './users.schemas.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/me', usersController.getMe);
usersRouter.patch('/me', validate({ body: updateProfileSchema }), usersController.updateMe);
usersRouter.patch(
  '/me/password',
  validate({ body: changePasswordSchema }),
  usersController.changePassword,
);
