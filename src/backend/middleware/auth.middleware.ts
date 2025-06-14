// Authentication middleware

import { Request, Response, NextFunction } from 'express';
import { AuthTokenPayload } from '@shared/types';
import { AuthenticationError } from '@shared/utils/errors';
import { UserService } from '../services/user.service';
import { logger } from '@shared/utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      userId?: string;
    }
  }
}

export class AuthMiddleware {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Verify JWT token and attach user to request
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        throw new AuthenticationError('No token provided');
      }

      const payload = await this.userService.verifyToken(token);
      
      // Attach user info to request
      req.user = payload;
      req.userId = payload.userId;

      next();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify user has required role
   */
  authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next(new AuthenticationError('User not authenticated'));
      }

      if (!roles.includes(req.user.role)) {
        return next(new AuthenticationError('Insufficient permissions'));
      }

      next();
    };
  };

  /**
   * Optional authentication - doesn't fail if no token
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        const payload = await this.userService.verifyToken(token);
        req.user = payload;
        req.userId = payload.userId;
      }

      next();
    } catch (error) {
      // Log error but continue without auth
      logger.debug('Optional auth failed', { error });
      next();
    }
  };

  /**
   * Demo mode authentication
   */
  demoAuth = (req: Request, res: Response, next: NextFunction): void => {
    if (req.headers['x-demo-mode'] === 'true') {
      req.user = {
        userId: 'demo-' + Math.random().toString(36).substr(2, 9),
        role: 'demo'
      } as AuthTokenPayload;
      req.userId = req.user.userId;
    }
    next();
  };

  /**
   * Extract token from request
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter (for WebSocket connections)
    if (req.query.token && typeof req.query.token === 'string') {
      return req.query.token;
    }

    // Check cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    return null;
  }
}

// Export middleware instances
const authMiddleware = new AuthMiddleware();

export const authenticate = authMiddleware.authenticate;
export const authorize = authMiddleware.authorize;
export const optionalAuth = authMiddleware.optionalAuth;
export const demoAuth = authMiddleware.demoAuth;