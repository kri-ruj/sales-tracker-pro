/**
 * Firestore Database Service
 * Handles all database operations using Google Firestore
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  if (process.env.NODE_ENV === 'production') {
    // In production, use Application Default Credentials
    admin.initializeApp({
      projectId: 'salesappfkt'
    });
  } else {
    // In development, you can use a service account file
    const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'salesappfkt'
      });
    } else {
      admin.initializeApp({
        projectId: 'salesappfkt'
      });
    }
  }
}

// Get Firestore instance (default database)
const db = admin.firestore();

// Collection references
const collections = {
  users: db.collection('users'),
  activities: db.collection('activities'),
  groups: db.collection('groups'),
  cache: db.collection('cache'),
  stats: db.collection('stats')
};

class FirestoreService {
  // User operations
  async createOrUpdateUser(lineUserId, userData) {
    try {
      const userRef = collections.users.doc(lineUserId);
      const doc = await userRef.get();
      
      // Clean undefined values
      const cleanData = Object.entries(userData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      if (doc.exists) {
        // Update existing user
        await userRef.update({
          ...cleanData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new user
        await userRef.set({
          ...cleanData,
          settings: {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return { lineUserId, ...userData };
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw error;
    }
  }

  async getUser(lineUserId) {
    try {
      const doc = await collections.users.doc(lineUserId).get();
      if (!doc.exists) return null;
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async updateUserSettings(lineUserId, settings) {
    try {
      await collections.users.doc(lineUserId).update({
        settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }

  // Activity operations
  async createActivity(activityData) {
    try {
      const docRef = await collections.activities.add({
        ...activityData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update user stats
      await this.updateUserStats(activityData.lineUserId);
      
      return { id: docRef.id, ...activityData };
    } catch (error) {
      console.error('Error creating activity:', error);
      throw error;
    }
  }

  async getUserActivities(lineUserId, date = null) {
    try {
      let query = collections.activities
        .where('lineUserId', '==', lineUserId);
      
      if (date) {
        query = query.where('date', '==', date);
      }
      
      // Get activities without orderBy to avoid index requirement
      const snapshot = await query.limit(100).get();
      const activities = [];
      
      snapshot.forEach(doc => {
        activities.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort in memory instead
      activities.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.timestamp || a.date);
        const dateB = new Date(b.createdAt || b.timestamp || b.date);
        return dateB - dateA; // Descending order
      });
      
      return activities;
    } catch (error) {
      console.error('Error getting user activities:', error);
      throw error;
    }
  }

  async deleteActivity(activityId) {
    try {
      await collections.activities.doc(activityId).delete();
      return true;
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  }

  // Get activities by date range
  async getActivitiesByDateRange(lineUserId, startDate, endDate) {
    try {
      let query = collections.activities;
      
      if (lineUserId) {
        query = query.where('lineUserId', '==', lineUserId);
      }
      
      query = query
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'desc');
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting activities by date range:', error);
      return [];
    }
  }

  // Team/Stats operations
  async getTeamStats() {
    try {
      // Check cache first
      const cacheDoc = await collections.cache.doc('team_stats').get();
      
      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        if (cacheData.expiresAt.toDate() > new Date()) {
          return cacheData.data;
        }
      }
      
      // Calculate fresh stats
      const stats = await this.calculateTeamStats();
      
      // Cache for 1 hour
      await collections.cache.doc('team_stats').set({
        data: stats,
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 60 * 60 * 1000)
        )
      });
      
      return stats;
    } catch (error) {
      console.error('Error getting team stats:', error);
      throw error;
    }
  }

  async calculateTeamStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const stats = {
        totalUsers: 0,
        totalPoints: 0,
        totalActivities: 0,
        todayPoints: 0,
        todayActivities: 0,
        topPerformers: []
      };
      
      // Get all users
      const usersSnapshot = await collections.users.get();
      stats.totalUsers = usersSnapshot.size;
      
      // Get all activities
      const activitiesSnapshot = await collections.activities.get();
      const userPoints = {};
      
      activitiesSnapshot.forEach(doc => {
        const activity = doc.data();
        stats.totalActivities++;
        stats.totalPoints += activity.points || 0;
        
        if (activity.date === today) {
          stats.todayActivities++;
          stats.todayPoints += activity.points || 0;
        }
        
        // Accumulate points per user
        if (!userPoints[activity.lineUserId]) {
          userPoints[activity.lineUserId] = 0;
        }
        userPoints[activity.lineUserId] += activity.points || 0;
      });
      
      // Get top performers
      const sortedUsers = Object.entries(userPoints)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);
      
      for (const [userId, points] of sortedUsers) {
        const userDoc = await collections.users.doc(userId).get();
        if (userDoc.exists) {
          stats.topPerformers.push({
            userId,
            displayName: userDoc.data().displayName,
            points
          });
        }
      }
      
      return stats;
    } catch (error) {
      console.error('Error calculating team stats:', error);
      throw error;
    }
  }

  // Leaderboard operations
  async getLeaderboard(period = 'daily', date = null) {
    try {
      const cacheKey = `leaderboard_${period}_${date || 'current'}`;
      
      // Check cache
      const cacheDoc = await collections.cache.doc(cacheKey).get();
      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data();
        if (cacheData.expiresAt.toDate() > new Date()) {
          return cacheData.data;
        }
      }
      
      // Calculate fresh leaderboard
      const leaderboard = await this.calculateLeaderboard(period, date);
      
      // Cache for 5 minutes
      await collections.cache.doc(cacheKey).set({
        data: leaderboard,
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 5 * 60 * 1000)
        )
      });
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  async calculateLeaderboard(period, date) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      let startDate, endDate;
      
      switch (period) {
        case 'daily':
          startDate = targetDate;
          endDate = targetDate;
          break;
        case 'weekly':
          // Get start of week (Monday)
          const d = new Date(targetDate);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          startDate = new Date(d.setDate(diff)).toISOString().split('T')[0];
          endDate = new Date(d.setDate(diff + 6)).toISOString().split('T')[0];
          break;
        case 'monthly':
          startDate = targetDate.substring(0, 7) + '-01';
          const lastDay = new Date(targetDate.substring(0, 4), targetDate.substring(5, 7), 0);
          endDate = lastDay.toISOString().split('T')[0];
          break;
      }
      
      // Get activities within date range
      let query = collections.activities;
      if (period === 'daily') {
        query = query.where('date', '==', startDate);
      } else {
        query = query
          .where('date', '>=', startDate)
          .where('date', '<=', endDate);
      }
      
      const snapshot = await query.get();
      const userStats = {};
      
      // Aggregate points and activities by user
      snapshot.forEach(doc => {
        const activity = doc.data();
        if (!userStats[activity.lineUserId]) {
          userStats[activity.lineUserId] = {
            points: 0,
            activities: 0
          };
        }
        userStats[activity.lineUserId].points += activity.points || 0;
        userStats[activity.lineUserId].activities++;
      });
      
      // Get user details and create leaderboard
      const leaderboard = [];
      for (const [userId, stats] of Object.entries(userStats)) {
        const userDoc = await collections.users.doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          leaderboard.push({
            userId,
            displayName: userData.displayName,
            pictureUrl: userData.pictureUrl,
            ...stats
          });
        }
      }
      
      // Sort by points
      leaderboard.sort((a, b) => b.points - a.points);
      
      // Add rankings
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });
      
      return {
        period,
        startDate,
        endDate,
        entries: leaderboard,
        totalParticipants: leaderboard.length
      };
    } catch (error) {
      console.error('Error calculating leaderboard:', error);
      throw error;
    }
  }

  // Group operations
  async registerGroup(groupId, groupName, registeredBy) {
    try {
      await collections.groups.doc(groupId).set({
        groupName,
        registeredBy,
        notificationsEnabled: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error registering group:', error);
      throw error;
    }
  }

  async getGroup(groupId) {
    try {
      const doc = await collections.groups.doc(groupId).get();
      if (!doc.exists) return null;
      
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error getting group:', error);
      throw error;
    }
  }

  async getAllGroups() {
    try {
      const snapshot = await collections.groups.get();
      const groups = [];
      
      snapshot.forEach(doc => {
        groups.push({ id: doc.id, ...doc.data() });
      });
      
      return groups;
    } catch (error) {
      console.error('Error getting all groups:', error);
      throw error;
    }
  }

  async toggleGroupNotifications(groupId) {
    try {
      const groupRef = collections.groups.doc(groupId);
      const doc = await groupRef.get();
      
      if (!doc.exists) return false;
      
      const currentStatus = doc.data().notificationsEnabled;
      await groupRef.update({
        notificationsEnabled: !currentStatus
      });
      
      return !currentStatus;
    } catch (error) {
      console.error('Error toggling group notifications:', error);
      throw error;
    }
  }

  // Helper methods
  async updateUserStats(lineUserId) {
    try {
      const activities = await this.getUserActivities(lineUserId);
      let totalPoints = 0;
      let totalActivities = activities.length;
      
      activities.forEach(activity => {
        totalPoints += activity.points || 0;
      });
      
      await collections.users.doc(lineUserId).update({
        totalPoints,
        totalActivities,
        lastActivityAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  // Achievement operations
  async getUserAchievements(lineUserId) {
    try {
      const userRef = collections.users.doc(lineUserId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return [];
      }
      
      const userData = userDoc.data();
      return userData.achievements || [];
    } catch (error) {
      console.error('Error getting user achievements:', error);
      throw error;
    }
  }

  async unlockAchievement(lineUserId, achievementId) {
    try {
      const userRef = collections.users.doc(lineUserId);
      const userDoc = await userRef.get();
      
      let achievements = [];
      let newUnlock = false;
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        achievements = userData.achievements || [];
        
        // Check if achievement is already unlocked
        const existingAchievement = achievements.find(a => a.achievement_id === achievementId);
        if (!existingAchievement) {
          achievements.push({
            achievement_id: achievementId,
            unlocked_at: admin.firestore.FieldValue.serverTimestamp()
          });
          newUnlock = true;
          
          await userRef.update({
            achievements,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // Create user with achievement
        achievements = [{
          achievement_id: achievementId,
          unlocked_at: admin.firestore.FieldValue.serverTimestamp()
        }];
        newUnlock = true;
        
        await userRef.set({
          achievements,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      return { newUnlock };
    } catch (error) {
      console.error('Error unlocking achievement:', error);
      throw error;
    }
  }

  // Streak operations
  async getUserStreak(lineUserId) {
    try {
      const userRef = collections.users.doc(lineUserId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return { current_streak: 0, longest_streak: 0, last_activity_date: null };
      }
      
      const userData = userDoc.data();
      return userData.streak || { current_streak: 0, longest_streak: 0, last_activity_date: null };
    } catch (error) {
      console.error('Error getting user streak:', error);
      throw error;
    }
  }

  async updateUserStreak(lineUserId, streakData) {
    try {
      const userRef = collections.users.doc(lineUserId);
      
      await userRef.update({
        streak: {
          current_streak: streakData.currentStreak || 0,
          longest_streak: streakData.longestStreak || 0,
          last_activity_date: streakData.lastActivityDate
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user streak:', error);
      throw error;
    }
  }

  // Cache cleanup
  async cleanupExpiredCache() {
    try {
      const now = admin.firestore.Timestamp.now();
      const snapshot = await collections.cache
        .where('expiresAt', '<', now)
        .get();
      
      const batch = db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired cache entries`);
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }
}

module.exports = new FirestoreService();