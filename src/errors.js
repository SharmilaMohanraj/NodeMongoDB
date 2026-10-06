class AppError extends Error { constructor(code, message, status, options = {}) { super(message, options); this.code = code; this.status = status; } }
class ValidationError extends AppError { constructor(message = 'Request validation failed', options) { super('VALIDATION_ERROR', message, 400, options); } }
class AuthenticationError extends AppError { constructor(message = 'Authentication required', options) { super('AUTHENTICATION_ERROR', message, 401, options); } }
class AuthorizationError extends AppError { constructor(message = 'Insufficient permissions', options) { super('AUTHORIZATION_ERROR', message, 403, options); } }
class NotFoundError extends AppError { constructor(message = 'Resource not found', options) { super('NOT_FOUND', message, 404, options); } }
class ConflictError extends AppError { constructor(message = 'Resource conflict', options) { super('CONFLICT', message, 409, options); } }
module.exports = { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError };
