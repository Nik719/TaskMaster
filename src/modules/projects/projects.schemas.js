import { z } from 'zod';
import { idParams, optionalText } from '../../utils/schemas.js';
import { paginationQuery } from '../../utils/pagination.js';
import { emailSchema } from '../auth/auth.schemas.js';

export const projectParams = idParams('projectId');
export const memberParams = idParams('projectId', 'userId');
export const invitationParams = idParams('projectId', 'invitationId');

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: optionalText(2000),
});

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const listProjectsQuery = z.object({
  ...paginationQuery,
  q: z.string().trim().max(120).optional(),
});

// OWNER is not assignable: there is exactly one owner, the creator.
const assignableRole = z.enum(['ADMIN', 'MEMBER']);

export const updateMemberSchema = z.object({ role: assignableRole });

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: assignableRole.default('MEMBER'),
});

export const listInvitationsQuery = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED']).optional(),
});
