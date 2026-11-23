import { z } from 'zod';

export const emailSchema = z
  .email('Must be a valid email address')
  .max(254)
  .transform((value) => value.trim().toLowerCase());

// Length matters most for password strength; the letter + digit rule blocks the
// most common trivial choices ("password", "12345678").
export const passwordSchema = z
  .string()
  .min(8, 'Must be at least 8 characters')
  .max(72, 'Must be at most 72 characters') // bcrypt ignores bytes beyond 72
  .regex(/[A-Za-z]/, 'Must contain at least one letter')
  .regex(/\d/, 'Must contain at least one number');

export const nameSchema = z.string().trim().min(1, 'Name is required').max(100);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules on login: just check what the user typed.
  password: z.string().min(1, 'Password is required').max(72),
});
