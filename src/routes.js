// Mounts every module's router under /api/v1. New modules are added here as each phase lands.
import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
