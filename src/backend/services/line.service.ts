// LINE messaging service

import { Client, FlexMessage, FlexBubble } from '@line/bot-sdk';
import { authConfig, servicesConfig } from '../config';
import { logger } from '@shared/utils/logger';
import { ExternalServiceError } from '@shared/utils/errors';

export class LineService {
  private client: Client;
  private quotaUsed: number = 0;
  private quotaLimit: number;

  constructor() {
    this.client = new Client({
      channelAccessToken: authConfig.line.channelAccessToken,
      channelSecret: authConfig.line.channelSecret
    });
    this.quotaLimit = servicesConfig.line.quotaLimit;
  }

  async replyMessage(replyToken: string, text: string): Promise<void> {
    try {
      await this.checkQuota();
      await this.client.replyMessage(replyToken, {
        type: 'text',
        text
      });
      this.incrementQuota();
    } catch (error) {
      logger.error('Failed to reply message', error as Error);
      throw new ExternalServiceError('LINE', error);
    }
  }

  async pushMessage(to: string, text: string): Promise<void> {
    try {
      await this.checkQuota();
      await this.client.pushMessage(to, {
        type: 'text',
        text
      });
      this.incrementQuota();
    } catch (error) {
      logger.error('Failed to push message', error as Error);
      throw new ExternalServiceError('LINE', error);
    }
  }

  async sendFlexMessage(to: string, altText: string, contents: FlexBubble): Promise<void> {
    try {
      await this.checkQuota();
      const flexMessage: FlexMessage = {
        type: 'flex',
        altText,
        contents
      };
      await this.client.pushMessage(to, flexMessage);
      this.incrementQuota();
    } catch (error) {
      logger.error('Failed to send flex message', error as Error);
      throw new ExternalServiceError('LINE', error);
    }
  }

  async multicast(to: string[], text: string): Promise<void> {
    if (to.length === 0) return;
    
    try {
      await this.checkQuota();
      await this.client.multicast(to, {
        type: 'text',
        text
      });
      this.incrementQuota(to.length);
    } catch (error) {
      logger.error('Failed to multicast message', error as Error);
      throw new ExternalServiceError('LINE', error);
    }
  }

  async broadcast(text: string): Promise<void> {
    try {
      await this.checkQuota();
      await this.client.broadcast({
        type: 'text',
        text
      });
      this.incrementQuota();
    } catch (error) {
      logger.error('Failed to broadcast message', error as Error);
      throw new ExternalServiceError('LINE', error);
    }
  }

  async getProfile(userId: string): Promise<any> {
    try {
      return await this.client.getProfile(userId);
    } catch (error) {
      logger.error('Failed to get user profile', error as Error, { userId });
      throw new ExternalServiceError('LINE', error);
    }
  }

  createLeaderboardFlexMessage(stats: any, period: string): FlexBubble {
    const periodEmoji = {
      daily: '📅',
      weekly: '📊',
      monthly: '🏆'
    }[period] || '📊';

    const leaderboardItems = stats.leaderboard.slice(0, 5).map((entry: any, index: number) => ({
      type: 'box' as const,
      layout: 'horizontal' as const,
      contents: [
        {
          type: 'text' as const,
          text: `${index + 1}.`,
          size: 'sm' as const,
          color: '#666666',
          flex: 1
        },
        {
          type: 'text' as const,
          text: entry.displayName,
          size: 'sm' as const,
          color: '#333333',
          flex: 4,
          wrap: true
        },
        {
          type: 'text' as const,
          text: `${entry.points} pts`,
          size: 'sm' as const,
          color: '#FF6B35',
          flex: 2,
          align: 'end' as const
        }
      ],
      margin: 'sm' as const
    }));

    return {
      type: 'bubble',
      size: 'nano', // Compact size
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${periodEmoji} ${period.charAt(0).toUpperCase() + period.slice(1)} Leaderboard`,
            weight: 'bold',
            size: 'md',
            color: '#FF6B35'
          }
        ],
        paddingAll: 'md'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          ...leaderboardItems,
          {
            type: 'separator',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'Team Total:',
                size: 'xs',
                color: '#666666'
              },
              {
                type: 'text',
                text: `${stats.teamTotal.points} pts`,
                size: 'xs',
                color: '#FF6B35',
                align: 'end',
                weight: 'bold'
              }
            ],
            margin: 'md'
          }
        ],
        paddingAll: 'md'
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'Open App',
              uri: `https://liff.line.me/${authConfig.line.liffId}`
            },
            style: 'primary',
            color: '#FF6B35',
            height: 'sm'
          }
        ],
        paddingAll: 'sm'
      }
    };
  }

  createActivityFlexMessage(activity: any, user: any): FlexBubble {
    const activityEmoji = {
      phone_call: '📞',
      meeting: '👥',
      follow_up: '📋',
      contract_sent: '📄',
      meeting_scheduled: '📅',
      project_booked: '🎯',
      other: '✨'
    }[activity.type] || '✨';

    return {
      type: 'bubble',
      size: 'nano',
      header: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: `${activityEmoji} New Activity`,
            weight: 'bold',
            size: 'sm',
            color: '#FF6B35',
            flex: 3
          },
          {
            type: 'text',
            text: `+${activity.points} pts`,
            size: 'xs',
            color: '#666666',
            align: 'end',
            flex: 1
          }
        ],
        paddingAll: 'md'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: user.displayName,
            size: 'xs',
            color: '#666666'
          },
          {
            type: 'text',
            text: activity.description,
            size: 'sm',
            color: '#333333',
            wrap: true,
            margin: 'sm'
          }
        ],
        paddingAll: 'md'
      }
    };
  }

  async getTeamStats(period: 'daily' | 'weekly' | 'monthly'): Promise<any> {
    // This would typically call ActivityService.getTeamStats
    // Simplified for this example
    return {
      period,
      leaderboard: [],
      teamTotal: {
        points: 0,
        activities: 0,
        activeUsers: 0
      }
    };
  }

  private async checkQuota(): Promise<void> {
    if (this.quotaUsed >= this.quotaLimit) {
      throw new Error('LINE message quota exceeded');
    }
  }

  private incrementQuota(count: number = 1): void {
    this.quotaUsed += count;
    logger.debug('LINE quota used', { used: this.quotaUsed, limit: this.quotaLimit });
  }

  getQuotaStatus(): { used: number; limit: number; remaining: number } {
    return {
      used: this.quotaUsed,
      limit: this.quotaLimit,
      remaining: this.quotaLimit - this.quotaUsed
    };
  }
}