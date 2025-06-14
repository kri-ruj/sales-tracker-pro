// User controller

import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { ActivityService } from '../services/activity.service';
import { ValidationError } from '@shared/utils/errors';
import { asyncHandler } from '../middleware/error.middleware';

export class UserController {
  private userService: UserService;
  private activityService: ActivityService;

  constructor() {
    this.userService = new UserService();
    this.activityService = new ActivityService();
  }

  /**
   * List users (with pagination)
   * GET /api/users
   */
  list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { limit = 20, offset = 0, orderBy = 'totalPoints' } = req.query;

    // This would typically require admin permissions
    // For now, we'll return limited data
    const users = await this.userService.getLeaderboard('monthly', parseInt(limit as string));

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
        totalPoints: user.totalPoints,
        level: user.level,
        currentStreak: user.currentStreak
      })),
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const currentUserId = req.userId!;

    // Check if requesting own profile or has permission
    if (id !== currentUserId && req.user?.role !== 'admin') {
      // Return limited public profile
      const user = await this.userService.findById(id);
      
      if (!user) {
        throw new ValidationError('User not found');
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          displayName: user.displayName,
          pictureUrl: user.pictureUrl,
          totalPoints: user.totalPoints,
          level: user.level
        },
        meta: {
          timestamp: new Date(),
          version: process.env.npm_package_version || '1.0.0'
        }
      });
      return;
    }

    // Return full profile
    const user = await this.userService.findById(id);
    
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
   * Get user's activities
   * GET /api/users/:id/activities
   */
  getActivities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const currentUserId = req.userId!;
    const { limit = 20, offset = 0, startDate, endDate } = req.query;

    // Check permissions
    if (id !== currentUserId && req.user?.role !== 'admin') {
      throw new ValidationError('Access denied');
    }

    const activities = await this.activityService.findByUserId(id, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      startDate: startDate as string,
      endDate: endDate as string
    });

    res.json({
      success: true,
      data: activities,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Get user's achievements
   * GET /api/users/:id/achievements
   */
  getAchievements = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const currentUserId = req.userId!;

    // Check permissions
    if (id !== currentUserId && req.user?.role !== 'admin') {
      // Return only unlocked achievements for other users
      const achievements = await this.activityService.checkAchievements(id);
      
      res.json({
        success: true,
        data: achievements.filter(a => a.unlockedAt),
        meta: {
          timestamp: new Date(),
          version: process.env.npm_package_version || '1.0.0'
        }
      });
      return;
    }

    // Return all achievements with progress
    const achievements = await this.activityService.checkAchievements(id);

    res.json({
      success: true,
      data: achievements,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });
}