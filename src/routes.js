// Mounts every module's router under /api/v1. New modules are added here as each phase lands.
import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { projectsRouter } from './modules/projects/projects.routes.js';
import { invitationsRouter } from './modules/invitations/invitations.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/invitations', invitationsRouter);
