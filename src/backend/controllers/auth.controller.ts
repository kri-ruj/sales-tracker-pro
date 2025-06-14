// Authentication controller

import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { LoginRequest } from '@shared/types';
import { ValidationError } from '@shared/utils/errors';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '@shared/utils/logger';

export class AuthController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Login endpoint
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const loginRequest: LoginRequest = req.body;

    // Validate request
    if (!loginRequest.provider) {
      throw new ValidationError('Provider is required');
    }

    if (loginRequest.provider !== 'demo' && !loginRequest.token) {
      throw new ValidationError('Token is required for non-demo authentication');
    }

    // Authenticate user
    const { user, token } = await this.userService.authenticate(loginRequest);

    logger.info('User logged in', {
      userId: user.id,
      provider: loginRequest.provider
    });

    res.json({
      success: true,
      data: {
        user,
        token
      },
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new ValidationError('User not found');
    }

    res.json({
      success: true,
      data: user,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Update current user profile
   * PUT /api/auth/me
   */
  updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const updates = req.body;

    const user = await this.userService.updateProfile(userId, updates);

    logger.info('User profile updated', { userId });

    res.json({
      success: true,
      data: user,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Logout endpoint (mainly for clearing server-side sessions if implemented)
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId;

    // Here you could invalidate tokens, clear sessions, etc.
    logger.info('User logged out', { userId });

    res.json({
      success: true,
      data: {
        message: 'Logged out successfully'
      },
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Refresh token endpoint
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // TODO: Implement refresh token logic
    throw new ValidationError('Refresh token not implemented');
  });
}