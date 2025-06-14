// Group registration service

import { GroupRegistration } from '@shared/types';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '@shared/utils/logger';
import { NotFoundError, ConflictError } from '@shared/utils/errors';

export class GroupService {
  private db: Firestore;
  private collectionName = 'group_registrations';

  constructor() {
    this.db = getFirestore();
  }

  async registerGroup(data: {
    groupId: string;
    groupName?: string;
    registeredBy: string;
  }): Promise<GroupRegistration> {
    try {
      // Check if already registered
      const existing = await this.findByGroupId(data.groupId);
      if (existing && existing.isActive) {
        throw new ConflictError('Group is already registered');
      }

      const registration: Partial<GroupRegistration> = {
        groupId: data.groupId,
        groupName: data.groupName,
        isActive: true,
        registeredAt: new Date(),
        registeredBy: data.registeredBy,
        notificationSettings: {
          dailyLeaderboard: true,
          achievements: true,
          milestones: true
        }
      };

      if (existing) {
        // Reactivate existing registration
        await this.db.collection(this.collectionName)
          .doc(existing.groupId)
          .update({
            isActive: true,
            registeredAt: new Date(),
            registeredBy: data.registeredBy
          });
        
        return { ...existing, ...registration } as GroupRegistration;
      } else {
        // Create new registration
        await this.db.collection(this.collectionName)
          .doc(data.groupId)
          .set(registration);
        
        logger.info('Group registered', { groupId: data.groupId });
        return registration as GroupRegistration;
      }
    } catch (error) {
      logger.error('Failed to register group', error as Error, { data });
      throw error;
    }
  }

  async unregisterGroup(groupId: string): Promise<void> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(groupId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('Group registration', groupId);
      }

      await docRef.update({
        isActive: false,
        unregisteredAt: new Date()
      });

      logger.info('Group unregistered', { groupId });
    } catch (error) {
      logger.error('Failed to unregister group', error as Error, { groupId });
      throw error;
    }
  }

  async findByGroupId(groupId: string): Promise<GroupRegistration | null> {
    try {
      const doc = await this.db.collection(this.collectionName).doc(groupId).get();
      
      if (!doc.exists) {
        return null;
      }

      return doc.data() as GroupRegistration;
    } catch (error) {
      logger.error('Failed to find group', error as Error, { groupId });
      throw error;
    }
  }

  async getActiveGroups(): Promise<GroupRegistration[]> {
    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('isActive', '==', true)
        .get();

      return snapshot.docs.map(doc => doc.data() as GroupRegistration);
    } catch (error) {
      logger.error('Failed to get active groups', error as Error);
      throw error;
    }
  }

  async updateNotificationSettings(
    groupId: string,
    settings: Partial<GroupRegistration['notificationSettings']>
  ): Promise<GroupRegistration> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(groupId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('Group registration', groupId);
      }

      const currentData = doc.data() as GroupRegistration;
      const updatedSettings = {
        ...currentData.notificationSettings,
        ...settings
      };

      await docRef.update({
        notificationSettings: updatedSettings,
        updatedAt: new Date()
      });

      return {
        ...currentData,
        notificationSettings: updatedSettings
      };
    } catch (error) {
      logger.error('Failed to update notification settings', error as Error, { groupId });
      throw error;
    }
  }

  async getGroupsForNotification(type: keyof GroupRegistration['notificationSettings']): Promise<string[]> {
    try {
      const groups = await this.getActiveGroups();
      
      return groups
        .filter(group => group.notificationSettings?.[type] !== false)
        .map(group => group.groupId);
    } catch (error) {
      logger.error('Failed to get groups for notification', error as Error, { type });
      throw error;
    }
  }
}