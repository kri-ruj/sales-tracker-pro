// User service implementation

import { User, LoginRequest, AuthTokenPayload } from '@shared/types';
import { UserRepository } from '../repositories/user.repository';
import { AuthenticationError, ValidationError, ConflictError } from '@shared/utils/errors';
import { logger } from '@shared/utils/logger';
import { authConfig } from '../config';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

export class UserService {
  private userRepository: UserRepository;
  private googleClient: OAuth2Client;

  constructor() {
    this.userRepository = new UserRepository();
    this.googleClient = new OAuth2Client(authConfig.google.clientId);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async findByLineUserId(lineUserId: string): Promise<User | null> {
    return this.userRepository.findByLineUserId(lineUserId);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findByGoogleId(googleId);
  }

  async authenticate(loginRequest: LoginRequest): Promise<{ user: User; token: string }> {
    let user: User | null = null;

    switch (loginRequest.provider) {
      case 'line':
        user = await this.authenticateLine(loginRequest.token!);
        break;
      case 'google':
        user = await this.authenticateGoogle(loginRequest.token!);
        break;
      case 'demo':
        user = await this.authenticateDemo(loginRequest.demoUserId!);
        break;
      default:
        throw new ValidationError('Invalid authentication provider');
    }

    if (!user) {
      throw new AuthenticationError('Authentication failed');
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  private async authenticateLine(accessToken: string): Promise<User | null> {
    try {
      // Verify LINE access token
      const response = await axios.get('https://api.line.me/v2/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const profile = response.data;
      
      // Find or create user
      let user = await this.userRepository.findByLineUserId(profile.userId);
      
      if (!user) {
        user = await this.userRepository.create({
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          role: 'user'
        });
        logger.info('New LINE user created', { userId: user.id, lineUserId: profile.userId });
      } else {
        // Update profile if changed
        if (user.displayName !== profile.displayName || user.pictureUrl !== profile.pictureUrl) {
          user = await this.userRepository.update(user.id, {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
          });
        }
      }

      return user;
    } catch (error: any) {
      logger.error('LINE authentication failed', error, { accessToken });
      
      if (error.response?.status === 401) {
        throw new AuthenticationError('Invalid LINE access token');
      }
      
      throw error;
    }
  }

  private async authenticateGoogle(idToken: string): Promise<User | null> {
    try {
      // Verify Google ID token
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: authConfig.google.clientId
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new AuthenticationError('Invalid Google token');
      }

      // Find or create user
      let user = await this.userRepository.findByGoogleId(payload.sub);
      
      if (!user) {
        user = await this.userRepository.create({
          googleId: payload.sub,
          email: payload.email,
          displayName: payload.name || payload.email!,
          pictureUrl: payload.picture,
          role: 'user'
        });
        logger.info('New Google user created', { userId: user.id, googleId: payload.sub });
      } else {
        // Update profile if changed
        if (user.displayName !== payload.name || user.pictureUrl !== payload.picture) {
          user = await this.userRepository.update(user.id, {
            displayName: payload.name || user.displayName,
            pictureUrl: payload.picture
          });
        }
      }

      return user;
    } catch (error) {
      logger.error('Google authentication failed', error as Error);
      throw new AuthenticationError('Invalid Google token');
    }
  }

  private async authenticateDemo(demoUserId: string): Promise<User | null> {
    // Create or get demo user
    let user = await this.userRepository.findById(demoUserId);
    
    if (!user) {
      user = await this.userRepository.create({
        displayName: `Demo User ${demoUserId.substring(0, 6)}`,
        role: 'demo'
      });
      logger.info('New demo user created', { userId: user.id });
    }

    return user;
  }

  private generateToken(user: User): string {
    const payload: AuthTokenPayload = {
      userId: user.id,
      lineUserId: user.lineUserId,
      googleId: user.googleId,
      role: user.role
    };

    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.expiresIn
    });
  }

  async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = jwt.verify(token, authConfig.jwt.secret) as AuthTokenPayload;
      return payload;
    } catch (error) {
      logger.error('Token verification failed', error as Error);
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    // Validate updates
    const allowedFields = ['displayName', 'pictureUrl', 'email', 'settings'];
    const filteredUpdates: Partial<User> = {};

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key as keyof User] = updates[key as keyof User];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    return this.userRepository.update(userId, filteredUpdates);
  }

  async updateStreak(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActivityDate = user.lastActivityDate?.split('T')[0];

    let newStreak = user.currentStreak;

    if (!lastActivityDate) {
      // First activity
      newStreak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActivityDate === yesterdayStr) {
        // Consecutive day
        newStreak = user.currentStreak + 1;
      } else if (lastActivityDate !== today) {
        // Streak broken
        newStreak = 1;
      }
      // else: Same day, no change
    }

    return this.userRepository.updateStreak(userId, newStreak);
  }

  async getLeaderboard(
    period: 'daily' | 'weekly' | 'monthly',
    limit: number = 10
  ): Promise<User[]> {
    // This is a simplified version - in production, you'd calculate based on activities
    const users = await this.userRepository.findMany({
      orderBy: 'totalPoints',
      orderDirection: 'desc',
      limit
    });

    return users;
  }

  async delete(userId: string): Promise<void> {
    await this.userRepository.delete(userId);
  }
}