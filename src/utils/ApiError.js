// An error that is safe to show to API clients.
// Services throw these; the central error handler turns them into the standard error response.
// Any other kind of error is treated as an unexpected 500 and its message is hidden from clients.
export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} code Stable, machine-readable error code (e.g. "NOT_FOUND")
   * @param {string} message Human-readable message
   * @param {unknown} [details] Optional extra info, e.g. validation issues
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details, message = 'Request validation failed') {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(
    message = 'You do not have permission to perform this action',
    code = 'FORBIDDEN',
  ) {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Resource already exists', details) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
}
