// Error handling middleware

import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError, handleError } from '@shared/utils/errors';
import { logger } from '@shared/utils/logger';
import { config } from '../config';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Convert to AppError if needed
  const appError = handleError(err);

  // Log error
  const logContext = {
    requestId,
    method: req.method,
    url: req.url,
    userId: req.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };

  if (appError.isOperational) {
    logger.warn('Operational error occurred', logContext);
  } else {
    logger.error('Unexpected error occurred', err, logContext);
  }

  // Prepare response
  const response: ErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  // Include details in development
  if (config.isDevelopment() && appError.details) {
    response.error.details = appError.details;
  }

  // Include stack trace in development for non-operational errors
  if (config.isDevelopment() && !appError.isOperational) {
    response.error.details = {
      ...response.error.details,
      stack: err.stack
    };
  }

  // Set response status and send
  res.status(appError.statusCode).json(response);
}

/**
 * 404 handler middleware
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown'
    }
  };

  res.status(404).json(response);
}

/**
 * Async route wrapper to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error formatter for express-validator
 */
export function validationErrorFormatter(errors: any[]): AppError {
  const formattedErrors = errors.map(error => ({
    field: error.param,
    message: error.msg,
    value: error.value
  }));

  return new AppError(
    'VALIDATION_ERROR',
    'Validation failed',
    400,
    { errors: formattedErrors }
  );
}