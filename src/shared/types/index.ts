// Shared type definitions for Sales Tracker Pro

export interface User {
  id: string;
  lineUserId?: string;
  googleId?: string;
  displayName: string;
  pictureUrl?: string;
  email?: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
  totalPoints: number;
  level: number;
  role: 'user' | 'admin' | 'demo';
  createdAt: Date;
  updatedAt: Date;
  settings?: UserSettings;
}

export interface UserSettings {
  notifications: boolean;
  language: 'th' | 'en';
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface Activity {
  id: string;
  userId: string;
  type: ActivityType;
  description: string;
  points: number;
  date: string;
  time: string;
  status: 'pending' | 'completed' | 'cancelled';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum ActivityType {
  PHONE_CALL = 'phone_call',
  MEETING = 'meeting',
  FOLLOW_UP = 'follow_up',
  CONTRACT_SENT = 'contract_sent',
  MEETING_SCHEDULED = 'meeting_scheduled',
  PROJECT_BOOKED = 'project_booked',
  OTHER = 'other'
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  requirement: {
    type: 'streak' | 'total_points' | 'activity_count' | 'special';
    value: number;
    activityType?: ActivityType;
  };
  unlockedAt?: Date;
}

export interface TeamStats {
  daily: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  monthly: LeaderboardEntry[];
  teamTotal: {
    points: number;
    activities: number;
    activeUsers: number;
  };
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  points: number;
  activities: number;
  rank: number;
  change: number; // Position change from previous period
}

export interface GroupRegistration {
  groupId: string;
  groupName?: string;
  isActive: boolean;
  registeredAt: Date;
  registeredBy: string;
  notificationSettings?: {
    dailyLeaderboard: boolean;
    achievements: boolean;
    milestones: boolean;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: Date;
    version: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// Authentication Types
export interface AuthTokenPayload {
  userId: string;
  lineUserId?: string;
  googleId?: string;
  role: 'user' | 'admin' | 'demo';
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  provider: 'line' | 'google' | 'demo';
  token?: string;
  demoUserId?: string;
}

export interface LoginResponse extends ApiResponse<{
  user: User;
  token: string;
  refreshToken?: string;
}> {}

// WebSocket Event Types
export interface WebSocketEvent {
  type: 'activity_created' | 'achievement_unlocked' | 'leaderboard_updated' | 'user_updated';
  payload: any;
  userId?: string;
  timestamp: Date;
}

// Configuration Types
export interface AppConfig {
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  liff: {
    id: string;
  };
  google: {
    clientId: string;
  };
  features: {
    demoMode: boolean;
    offlineMode: boolean;
    aiAssistant: boolean;
  };
}