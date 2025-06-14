// Activity service implementation

import { Activity, ActivityType, User } from '@shared/types';
import { ActivityRepository, ActivityStats } from '../repositories/activity.repository';
import { UserService } from './user.service';
import { ValidationError, NotFoundError } from '@shared/utils/errors';
import { logger } from '@shared/utils/logger';
import { EventEmitter } from 'events';

export interface CreateActivityDto {
  userId: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
}

export interface UpdateActivityDto {
  type?: ActivityType;
  description?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  metadata?: Record<string, any>;
}

export class ActivityService extends EventEmitter {
  private activityRepository: ActivityRepository;
  private userService: UserService;

  // Points configuration by activity type
  private readonly POINTS_CONFIG: Record<ActivityType, number> = {
    [ActivityType.PHONE_CALL]: 10,
    [ActivityType.MEETING]: 20,
    [ActivityType.FOLLOW_UP]: 15,
    [ActivityType.CONTRACT_SENT]: 30,
    [ActivityType.MEETING_SCHEDULED]: 25,
    [ActivityType.PROJECT_BOOKED]: 50,
    [ActivityType.OTHER]: 5
  };

  constructor() {
    super();
    this.activityRepository = new ActivityRepository();
    this.userService = new UserService();
  }

  async create(data: CreateActivityDto): Promise<Activity> {
    // Validate input
    if (!data.userId || !data.type || !data.description) {
      throw new ValidationError('Missing required fields');
    }

    // Verify user exists
    const user = await this.userService.findById(data.userId);
    if (!user) {
      throw new NotFoundError('User', data.userId);
    }

    // Calculate points
    const points = this.POINTS_CONFIG[data.type] || 0;

    // Create activity
    const activity = await this.activityRepository.create({
      userId: data.userId,
      type: data.type,
      description: data.description,
      points,
      metadata: data.metadata
    });

    // Update user points and streak
    await this.updateUserStats(user, points);

    // Emit event for real-time updates
    this.emit('activity:created', { activity, user });

    logger.info('Activity created', {
      activityId: activity.id,
      userId: data.userId,
      type: data.type,
      points
    });

    return activity;
  }

  async findById(id: string): Promise<Activity | null> {
    return this.activityRepository.findById(id);
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<Activity[]> {
    if (options?.startDate && options?.endDate) {
      return this.activityRepository.findByDateRange(
        options.startDate,
        options.endDate,
        userId
      );
    }

    return this.activityRepository.findByUserId(userId, {
      limit: options?.limit,
      offset: options?.offset
    });
  }

  async update(id: string, userId: string, data: UpdateActivityDto): Promise<Activity> {
    // Verify activity exists and belongs to user
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new NotFoundError('Activity', id);
    }

    if (activity.userId !== userId) {
      throw new ValidationError('Activity does not belong to user');
    }

    // If changing type, recalculate points
    let updates: Partial<Activity> = { ...data };
    if (data.type && data.type !== activity.type) {
      updates.points = this.POINTS_CONFIG[data.type] || 0;
      
      // Update user points (subtract old, add new)
      const user = await this.userService.findById(userId);
      if (user) {
        const pointDiff = updates.points - activity.points;
        await this.updateUserPoints(user, pointDiff);
      }
    }

    const updatedActivity = await this.activityRepository.update(id, updates);
    
    // Emit event for real-time updates
    this.emit('activity:updated', { activity: updatedActivity });

    return updatedActivity;
  }

  async delete(id: string, userId: string): Promise<void> {
    // Verify activity exists and belongs to user
    const activity = await this.activityRepository.findById(id);
    if (!activity) {
      throw new NotFoundError('Activity', id);
    }

    if (activity.userId !== userId) {
      throw new ValidationError('Activity does not belong to user');
    }

    // Update user points (subtract)
    const user = await this.userService.findById(userId);
    if (user) {
      await this.updateUserPoints(user, -activity.points);
    }

    await this.activityRepository.delete(id);
    
    // Emit event for real-time updates
    this.emit('activity:deleted', { activityId: id, userId });

    logger.info('Activity deleted', { activityId: id, userId });
  }

  async getStats(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ActivityStats> {
    return this.activityRepository.getStats(userId, startDate, endDate);
  }

  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    return this.activityRepository.getRecentActivities(limit);
  }

  async getTeamStats(period: 'daily' | 'weekly' | 'monthly'): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
    }

    const activities = await this.activityRepository.findByDateRange(
      startDate.toISOString(),
      new Date().toISOString()
    );

    // Group by user and calculate stats
    const userStats = new Map<string, { points: number; activities: number }>();
    
    activities.forEach(activity => {
      const current = userStats.get(activity.userId) || { points: 0, activities: 0 };
      current.points += activity.points;
      current.activities += 1;
      userStats.set(activity.userId, current);
    });

    // Get user details and create leaderboard
    const leaderboard = await Promise.all(
      Array.from(userStats.entries()).map(async ([userId, stats]) => {
        const user = await this.userService.findById(userId);
        return {
          userId,
          displayName: user?.displayName || 'Unknown User',
          pictureUrl: user?.pictureUrl,
          points: stats.points,
          activities: stats.activities
        };
      })
    );

    // Sort by points and add ranks
    leaderboard.sort((a, b) => b.points - a.points);
    leaderboard.forEach((entry, index) => {
      (entry as any).rank = index + 1;
      (entry as any).change = 0; // TODO: Implement rank change tracking
    });

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      leaderboard,
      teamTotal: {
        points: leaderboard.reduce((sum, entry) => sum + entry.points, 0),
        activities: leaderboard.reduce((sum, entry) => sum + entry.activities, 0),
        activeUsers: leaderboard.length
      }
    };
  }

  private async updateUserStats(user: User, points: number): Promise<void> {
    try {
      // Update points
      await this.updateUserPoints(user, points);
      
      // Update streak
      await this.userService.updateStreak(user.id);
    } catch (error) {
      logger.error('Error updating user stats', error as Error, { 
        userId: user.id, 
        points 
      });
      // Don't throw - activity is already created
    }
  }

  private async updateUserPoints(user: User, points: number): Promise<void> {
    const userRepo = new (await import('../repositories/user.repository')).UserRepository();
    await userRepo.addPoints(user.id, points);
  }

  // Check for achievements based on activity
  async checkAchievements(userId: string): Promise<any[]> {
    // TODO: Implement achievement checking logic
    return [];
  }
}