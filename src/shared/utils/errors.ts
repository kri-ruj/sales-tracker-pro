// Centralized error handling utilities

export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // External service errors
  LINE_API_ERROR = 'LINE_API_ERROR',
  GOOGLE_API_ERROR = 'GOOGLE_API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  BAD_REQUEST = 'BAD_REQUEST'
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 500,
    public details?: any,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString()
    };
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    super(code, message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier ${identifier} not found`
      : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.CONFLICT, message, 409, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    const code = service === 'LINE' ? ErrorCode.LINE_API_ERROR : 
                 service === 'Google' ? ErrorCode.GOOGLE_API_ERROR :
                 ErrorCode.INTERNAL_ERROR;
    super(code, `External service error: ${service}`, 502, originalError);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      429,
      { retryAfter }
    );
  }
}

// Error handler utility
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: any): AppError {
  if (isAppError(error)) {
    return error;
  }

  // Handle known error types
  if (error.name === 'ValidationError') {
    return new ValidationError(error.message, error.errors);
  }

  if (error.name === 'CastError') {
    return new ValidationError('Invalid ID format');
  }

  if (error.code === 11000) {
    return new ConflictError('Duplicate entry found');
  }

  // Default to internal error
  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    500,
    process.env.NODE_ENV === 'development' ? error.stack : undefined,
    false
  );
}