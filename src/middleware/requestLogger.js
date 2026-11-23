// Logs one line per request and gives every request an ID.
// The ID is returned in the X-Request-Id response header, so a client-reported problem
// can be matched to the exact server log line.
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../config/logger.js';

// Accept a caller-supplied ID only if it looks sane, so clients can't inject junk into logs.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Keep request logs short: method, URL and ID are enough. Headers stay out of the logs.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
