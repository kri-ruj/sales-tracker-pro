// Activity controller

import { Request, Response } from 'express';
import { ActivityService, CreateActivityDto, UpdateActivityDto } from '../services/activity.service';
import { ValidationError } from '@shared/utils/errors';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '@shared/utils/logger';

export class ActivityController {
  private activityService: ActivityService;

  constructor() {
    this.activityService = new ActivityService();
  }

  /**
   * Create new activity
   * POST /api/activities
   */
  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const createDto: CreateActivityDto = {
      userId,
      ...req.body
    };

    const activity = await this.activityService.create(createDto);

    res.status(201).json({
      success: true,
      data: activity,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Get user's activities
   * GET /api/activities
   */
  getUserActivities = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { limit = 20, offset = 0, startDate, endDate } = req.query;

    const activities = await this.activityService.findByUserId(userId, {
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
   * Get single activity
   * GET /api/activities/:id
   */
  getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.userId!;

    const activity = await this.activityService.findById(id);

    if (!activity) {
      throw new ValidationError('Activity not found');
    }

    // Verify ownership
    if (activity.userId !== userId) {
      throw new ValidationError('Access denied');
    }

    res.json({
      success: true,
      data: activity,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Update activity
   * PUT /api/activities/:id
   */
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.userId!;
    const updateDto: UpdateActivityDto = req.body;

    const activity = await this.activityService.update(id, userId, updateDto);

    res.json({
      success: true,
      data: activity,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Delete activity
   * DELETE /api/activities/:id
   */
  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.userId!;

    await this.activityService.delete(id, userId);

    res.json({
      success: true,
      data: {
        message: 'Activity deleted successfully'
      },
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  /**
   * Get user's activity statistics
   * GET /api/activities/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const stats = await this.activityService.getStats(
      userId,
      startDate as string,
      endDate as string
    );

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
   * Get recent activities (for admin/dashboard)
   * GET /api/activities/recent
   */
  getRecent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { limit = 10 } = req.query;

    const activities = await this.activityService.getRecentActivities(
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: activities,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });
}