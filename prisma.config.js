// Prisma CLI configuration (Prisma 7+).
// The CLI no longer reads .env on its own, so we load it here.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Tests override this by setting DATABASE_URL in the child process
    // (see tests/setup/globalSetup.js), so a test run never touches the dev DB.
    url: process.env.DATABASE_URL,
  },
});
