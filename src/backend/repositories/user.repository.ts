// User repository implementation

import { User } from '@shared/types';
import { BaseRepository, QueryOptions } from './base.repository';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { NotFoundError } from '@shared/utils/errors';
import { logger } from '@shared/utils/logger';

export class UserRepository extends BaseRepository<User> {
  protected collectionName = 'users';
  private db: Firestore;

  constructor() {
    super();
    this.db = getFirestore();
  }

  async findById(id: string): Promise<User | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() } as User;
    } catch (error) {
      logger.error('Error finding user by id', error as Error, { userId: id });
      throw error;
    }
  }

  async findOne(query: Record<string, any>): Promise<User | null> {
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
      return { id: doc.id, ...doc.data() } as User;
    } catch (error) {
      logger.error('Error finding user', error as Error, { query });
      throw error;
    }
  }

  async findMany(options: QueryOptions = {}): Promise<User[]> {
    try {
      let query = this.db.collection(this.collectionName);

      // Apply where clauses
      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          query = query.where(key, '==', value) as any;
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.orderBy(options.orderBy, options.orderDirection || 'asc') as any;
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit) as any;
      }
      if (options.offset) {
        query = query.offset(options.offset) as any;
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    } catch (error) {
      logger.error('Error finding users', error as Error, { options });
      throw error;
    }
  }

  async findByLineUserId(lineUserId: string): Promise<User | null> {
    return this.findOne({ lineUserId });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.findOne({ googleId });
  }

  async create(data: Partial<User>): Promise<User> {
    try {
      const now = new Date();
      const userData = {
        ...data,
        createdAt: now,
        updatedAt: now,
        currentStreak: 0,
        longestStreak: 0,
        totalPoints: 0,
        level: 1,
        role: data.role || 'user',
        settings: data.settings || {
          notifications: true,
          language: 'th',
          timezone: 'Asia/Bangkok',
          theme: 'light'
        }
      };

      const docRef = await this.db.collection(this.collectionName).add(userData);
      const newUser = { id: docRef.id, ...userData } as User;
      
      logger.info('User created', { userId: docRef.id });
      return newUser;
    } catch (error) {
      logger.error('Error creating user', error as Error, { data });
      throw error;
    }
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('User', id);
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
      const updatedUser = { id: updatedDoc.id, ...updatedDoc.data() } as User;
      
      logger.info('User updated', { userId: id });
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user', error as Error, { userId: id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('User', id);
      }

      await docRef.delete();
      logger.info('User deleted', { userId: id });
    } catch (error) {
      logger.error('Error deleting user', error as Error, { userId: id });
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
      logger.error('Error counting users', error as Error, { query });
      throw error;
    }
  }

  async updateStreak(userId: string, newStreak: number): Promise<User> {
    try {
      const user = await this.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const updateData: Partial<User> = {
        currentStreak: newStreak,
        longestStreak: Math.max(user.longestStreak, newStreak),
        lastActivityDate: new Date().toISOString()
      };

      return this.update(userId, updateData);
    } catch (error) {
      logger.error('Error updating user streak', error as Error, { userId, newStreak });
      throw error;
    }
  }

  async addPoints(userId: string, points: number): Promise<User> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(userId);
      
      await docRef.update({
        totalPoints: FieldValue.increment(points),
        updatedAt: new Date()
      });

      const updatedDoc = await docRef.get();
      const user = { id: updatedDoc.id, ...updatedDoc.data() } as User;

      // Update level based on points
      const newLevel = this.calculateLevel(user.totalPoints);
      if (newLevel > user.level) {
        await this.update(userId, { level: newLevel });
      }

      return user;
    } catch (error) {
      logger.error('Error adding points to user', error as Error, { userId, points });
      throw error;
    }
  }

  private calculateLevel(totalPoints: number): number {
    // Simple level calculation: every 1000 points = 1 level
    return Math.floor(totalPoints / 1000) + 1;
  }
}