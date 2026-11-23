// Structured JSON logger (pino). In development, output is prettified for humans.
import pino from 'pino';
import { env } from './env.js';

// Anything matching these paths is replaced with "[REDACTED]" before it is written,
// so passwords, tokens and cookies never reach the logs.
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: { service: 'taskmaster-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname,service,env',
        singleLine: true,
      },
    },
  }),
});
