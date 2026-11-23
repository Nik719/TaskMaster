// Loads and validates environment variables once, at startup.
// A missing or malformed variable crashes the process immediately with a clear message,
// instead of failing later in the middle of a request.
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Separate database used by the automated tests (it gets wiped between tests in later phases).
  TEST_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),

  // Comma-separated list of allowed browser origins, e.g. "http://localhost:3000,http://localhost:5173".
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Set to the number of proxies in front of the app (e.g. 1 behind Render/Nginx) so
  // req.ip and rate limiting see the real client IP. 0 = no proxy.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // ── Authentication ──
  // Signs the short-lived access tokens. Generate one with:
  //   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // Lifetime of an access token, in a format jsonwebtoken understands (e.g. "15m", "1h").
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  // How long a login lasts without activity. Each refresh rotates the token and extends it.
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // bcrypt cost factor. 12 is a sensible production value; tests drop to 4 for speed.
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // The logger depends on env, so plain console is the only option here.
    console.error(`Invalid environment configuration:\n${problems}\n\nSee .env.example.`);
    process.exit(1);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'test') {
    if (!env.TEST_DATABASE_URL) {
      console.error('TEST_DATABASE_URL must be set to run the tests. See .env.example.');
      process.exit(1);
    }
    if (env.TEST_DATABASE_URL === env.DATABASE_URL) {
      console.error('TEST_DATABASE_URL must point to a different database than DATABASE_URL.');
      process.exit(1);
    }
    // Everything in the app reads env.DATABASE_URL, so swapping it here is enough.
    env.DATABASE_URL = env.TEST_DATABASE_URL;
    // Hashing at full cost would make the auth tests needlessly slow.
    env.BCRYPT_SALT_ROUNDS = 4;
    // Keep test output readable. Set TEST_LOG_LEVEL=debug to see logs while debugging a test.
    const testLogLevel = envSchema.shape.LOG_LEVEL.safeParse(process.env.TEST_LOG_LEVEL);
    env.LOG_LEVEL =
      testLogLevel.success && process.env.TEST_LOG_LEVEL ? testLogLevel.data : 'silent';
  }

  return Object.freeze({
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  });
}

export const env = loadEnv();
