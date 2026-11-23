// Zod building blocks shared by several modules.
import { z } from 'zod';

export const uuid = z.uuid('Must be a valid UUID');

/** Params schema for routes like /projects/:projectId, e.g. idParams('projectId'). */
export const idParams = (...names) => z.object(Object.fromEntries(names.map((n) => [n, uuid])));

/** "a,b,c" or ["a","b"] → validated array of enum values (for ?status=OPEN,COMPLETED). */
export const csvEnum = (values) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((input) =>
      (Array.isArray(input) ? input : input.split(','))
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values)).min(1));

/** Optional free text: trims, and turns "" into null so it clears the field. */
export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
