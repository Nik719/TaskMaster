import { z } from 'zod';
import { nameSchema, passwordSchema } from '../auth/auth.schemas.js';

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    // null clears the field
    bio: z.string().trim().max(500).nullable().optional(),
    avatarUrl: z
      .url({ protocol: /^https?$/ })
      .max(2048)
      .nullable()
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(72),
    newPassword: passwordSchema,
  })
  .refine((body) => body.currentPassword !== body.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });
