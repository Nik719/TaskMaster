// Runs once before the whole test suite: brings the TEST database schema up to date.
import 'dotenv/config';
import { execSync } from 'node:child_process';

export default function setup() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must point to a different database than DATABASE_URL.');
  }

  // prisma.config.js reads DATABASE_URL, so we point it at the test DB for this child process only.
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
