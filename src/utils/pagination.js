import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

/** Zod fields for ?page=&limit=, meant to be spread into a query schema. */
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
};

/** Prisma skip/take for a page. */
export function pageArgs({ page, limit }) {
  return { skip: (page - 1) * limit, take: limit };
}

export function pageMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
