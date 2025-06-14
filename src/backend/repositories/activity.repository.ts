// Activity repository implementation

import { Activity, ActivityType } from '@shared/types';
import { BaseRepository, QueryOptions } from './base.repository';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { NotFoundError } from '@shared/utils/errors';
import { logger } from '@shared/utils/logger';

export interface ActivityStats {
  totalActivities: number;
  totalPoints: number;
  byType: Record<ActivityType, { count: number; points: number }>;
  dailyAverage: number;
}

export class ActivityRepository extends BaseRepository<Activity> {
  protected collectionName = 'activities';
  private db: Firestore;

  constructor() {
    super();
    this.db = getFirestore();
  }

  async findById(id: string): Promise<Activity | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() } as Activity;
    } catch (error) {
      logger.error('Error finding activity by id', error as Error, { activityId: id });
      throw error;
    }
  }

  async findOne(query: Record<string, any>): Promise<Activity | null> {
    try {
      let queryRef = this.db.collection(this.collectionName);
      
      Object.entries(query).forEach(([key, value]) => {
        queryRef = queryRef.where(key, '==', value) as any;
      });

      const snapshot = await queryRef.limit(1).get();
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Activity;
    } catch (error) {
      logger.error('Error finding activity', error as Error, { query });
      throw error;
    }
  }

  async findMany(options: QueryOptions = {}): Promise<Activity[]> {
    try {
      let query = this.db.collection(this.collectionName);

      // Apply where clauses
      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          query = query.where(key, '==', value) as any;
        });
      }

      // Apply ordering (default to createdAt desc)
      const orderBy = options.orderBy || 'createdAt';
      const orderDirection = options.orderDirection || 'desc';
      query = query.orderBy(orderBy, orderDirection) as any;

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit) as any;
      }
      if (options.offset) {
        query = query.offset(options.offset) as any;
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
    } catch (error) {
      logger.error('Error finding activities', error as Error, { options });
      throw error;
    }
  }

  async findByUserId(userId: string, options: QueryOptions = {}): Promise<Activity[]> {
    return this.findMany({
      ...options,
      where: { ...options.where, userId }
    });
  }

  async findByDateRange(
    startDate: string,
    endDate: string,
    userId?: string
  ): Promise<Activity[]> {
    try {
      let query = this.db.collection(this.collectionName)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate);

      if (userId) {
        query = query.where('userId', '==', userId) as any;
      }

      const snapshot = await query.orderBy('date', 'desc').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
    } catch (error) {
      logger.error('Error finding activities by date range', error as Error, { 
        startDate, endDate, userId 
      });
      throw error;
    }
  }

  async create(data: Partial<Activity>): Promise<Activity> {
    try {
      const now = new Date();
      const activityData = {
        ...data,
        status: data.status || 'completed',
        createdAt: now,
        updatedAt: now,
        date: data.date || now.toISOString().split('T')[0],
        time: data.time || now.toTimeString().split(' ')[0]
      };

      const docRef = await this.db.collection(this.collectionName).add(activityData);
      const newActivity = { id: docRef.id, ...activityData } as Activity;
      
      logger.info('Activity created', { 
        activityId: docRef.id, 
        userId: data.userId,
        type: data.type 
      });
      
      return newActivity;
    } catch (error) {
      logger.error('Error creating activity', error as Error, { data });
      throw error;
    }
  }

  async update(id: string, data: Partial<Activity>): Promise<Activity> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('Activity', id);
      }

      const updateData = {
        ...data,
        updatedAt: new Date()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      await docRef.update(updateData);
      
      const updatedDoc = await docRef.get();
      const updatedActivity = { id: updatedDoc.id, ...updatedDoc.data() } as Activity;
      
      logger.info('Activity updated', { activityId: id });
      return updatedActivity;
    } catch (error) {
      logger.error('Error updating activity', error as Error, { activityId: id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('Activity', id);
      }

      await docRef.delete();
      logger.info('Activity deleted', { activityId: id });
    } catch (error) {
      logger.error('Error deleting activity', error as Error, { activityId: id });
      throw error;
    }
  }

  async count(query?: Record<string, any>): Promise<number> {
    try {
      let queryRef = this.db.collection(this.collectionName);
      
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          queryRef = queryRef.where(key, '==', value) as any;
        });
      }

      const snapshot = await queryRef.count().get();
      return snapshot.data().count;
    } catch (error) {
      logger.error('Error counting activities', error as Error, { query });
      throw error;
    }
  }

  async getStats(userId: string, startDate?: string, endDate?: string): Promise<ActivityStats> {
    try {
      let query = this.db.collection(this.collectionName).where('userId', '==', userId);

      if (startDate && endDate) {
        query = query
          .where('date', '>=', startDate)
          .where('date', '<=', endDate) as any;
      }

      const snapshot = await query.get();
      const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));

      const stats: ActivityStats = {
        totalActivities: activities.length,
        totalPoints: 0,
        byType: {} as Record<ActivityType, { count: number; points: number }>,
        dailyAverage: 0
      };

      // Initialize all activity types
      Object.values(ActivityType).forEach(type => {
        stats.byType[type] = { count: 0, points: 0 };
      });

      // Calculate stats
      activities.forEach(activity => {
        stats.totalPoints += activity.points;
        stats.byType[activity.type].count++;
        stats.byType[activity.type].points += activity.points;
      });

      // Calculate daily average
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        stats.dailyAverage = stats.totalActivities / days;
      }

      return stats;
    } catch (error) {
      logger.error('Error getting activity stats', error as Error, { userId, startDate, endDate });
      throw error;
    }
  }

  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    return this.findMany({ limit, orderBy: 'createdAt', orderDirection: 'desc' });
  }
}