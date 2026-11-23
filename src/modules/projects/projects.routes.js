import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import * as c from './projects.controller.js';
import {
  createInvitationSchema,
  createProjectSchema,
  invitationParams,
  listInvitationsQuery,
  listProjectsQuery,
  memberParams,
  projectParams,
  updateMemberSchema,
  updateProjectSchema,
} from './projects.schemas.js';

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter
  .route('/')
  .post(validate({ body: createProjectSchema }), c.create)
  .get(validate({ query: listProjectsQuery }), c.list);

projectsRouter
  .route('/:projectId')
  .get(validate({ params: projectParams }), c.get)
  .patch(validate({ params: projectParams, body: updateProjectSchema }), c.update)
  .delete(validate({ params: projectParams }), c.remove);

projectsRouter.get('/:projectId/members', validate({ params: projectParams }), c.listMembers);
projectsRouter
  .route('/:projectId/members/:userId')
  .patch(validate({ params: memberParams, body: updateMemberSchema }), c.updateMember)
  .delete(validate({ params: memberParams }), c.removeMember);

projectsRouter
  .route('/:projectId/invitations')
  .post(validate({ params: projectParams, body: createInvitationSchema }), c.invite)
  .get(validate({ params: projectParams, query: listInvitationsQuery }), c.listInvitations);
projectsRouter.delete(
  '/:projectId/invitations/:invitationId',
  validate({ params: invitationParams }),
  c.revokeInvitation,
);
