import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import * as authController from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export const authRouter = Router();

const refreshBody = z.object({ refreshToken: z.string().max(512).optional() });

authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/refresh', authLimiter, validate({ body: refreshBody }), authController.refresh);
authRouter.post('/logout', authenticate, authController.logout);
authRouter.post('/logout-all', authenticate, authController.logoutAll);
