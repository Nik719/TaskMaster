// Validates req.body / req.query / req.params against Zod schemas.
//
// Usage in a route:
//   router.post('/', validate({ body: createProjectSchema }), controller.create)
//
// The parsed (and type-coerced) values are stored on req.validated, because in Express 5
// req.query is a read-only getter and can't be overwritten. Controllers should read from
// req.validated, never from the raw req.body/req.query. Unknown body fields are stripped by
// Zod's default object behaviour, which protects against mass assignment
// (e.g. a client sending "role": "OWNER").
import { ApiError } from '../utils/ApiError.js';

const SOURCES = ['params', 'query', 'body'];

export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const issues = [];

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source] ?? {});
      if (result.success) {
        validated[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({
            location: source,
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (issues.length > 0) {
      return next(ApiError.validation(issues));
    }

    req.validated = { ...req.validated, ...validated };
    return next();
  };
}
