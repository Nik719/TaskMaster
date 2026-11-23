// Every successful response uses the same envelope:
//   { "success": true, "data": ..., "meta": { ... } }   ("meta" only on paginated lists)

/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {{ status?: number, meta?: object }} [options]
 */
export function sendSuccess(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

/** For 204 responses (e.g. logout, delete): no body at all. */
export function sendNoContent(res) {
  return res.status(204).end();
}
