import { z } from 'zod';
import { idParams } from '../../utils/schemas.js';
import { paginationQuery } from '../../utils/pagination.js';

export const taskParams = idParams('taskId');
export const commentParams = idParams('taskId', 'commentId');
export const listCommentsQuery = z.object({
  ...paginationQuery,
  limit: paginationQuery.limit.default(50),
});
export const commentBody = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});
