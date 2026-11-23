// The invitee's side of invitations. (Sending and revoking live under /projects/:id/invitations.)
import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { idParams } from '../../utils/schemas.js';
import * as c from './invitations.controller.js';

export const invitationsRouter = Router();

const params = idParams('invitationId');

invitationsRouter.use(authenticate);
invitationsRouter.get('/', c.listMine);
invitationsRouter.post('/:invitationId/accept', validate({ params }), c.accept);
invitationsRouter.post('/:invitationId/decline', validate({ params }), c.decline);
