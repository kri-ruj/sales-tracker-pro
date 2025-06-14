// Team controller

import { Request, Response } from 'express';
import { ActivityService } from '../services/activity.service';
import { asyncHandler } from '../middleware/error.middleware';
import { ValidationError } from '@shared/utils/errors';

export class TeamController {
  private activityService: ActivityService;

  constructor() {
    this.activityService = new ActivityService();
  }

  /**
   * Get team statistics
   * GET /api/team/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { period = 'daily' } = req.query;

    if (!['daily', 'weekly', 'monthly'].includes(period as string)) {
      throw new ValidationError('Invalid period. Must be daily, weekly, or monthly');
    }

    const stats = await this.activityService.getTeamStats(period as any);

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Get team leaderboard
   * GET /api/team/leaderboard/:period
   */
  getLeaderboard = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { period } = req.params;
    const { limit = 10 } = req.query;

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      throw new ValidationError('Invalid period. Must be daily, weekly, or monthly');
    }

    const stats = await this.activityService.getTeamStats(period as any);

    // Return just the leaderboard portion
    res.json({
      success: true,
      data: {
        period,
        leaderboard: stats.leaderboard.slice(0, parseInt(limit as string)),
        teamTotal: stats.teamTotal
      },
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });
}