// Webhook controller for LINE integration

import { Request, Response } from 'express';
import { WebhookRequestBody, TextEventMessage, MessageEvent } from '@line/bot-sdk';
import { asyncHandler } from '../middleware/error.middleware';
import { logger } from '@shared/utils/logger';
import { createHmac } from 'crypto';
import { authConfig } from '../config';
import { LineService } from '../services/line.service';
import { GroupService } from '../services/group.service';

export class WebhookController {
  private lineService: LineService;
  private groupService: GroupService;

  constructor() {
    this.lineService = new LineService();
    this.groupService = new GroupService();
  }

  /**
   * Handle LINE webhook events
   * POST /api/webhook
   */
  handleWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers['x-line-signature'] as string;
    
    // Verify webhook signature
    if (!this.verifySignature(req.body, signature)) {
      logger.warn('Invalid webhook signature');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    const body: WebhookRequestBody = req.body;

    // Process events asynchronously
    setImmediate(async () => {
      for (const event of body.events) {
        try {
          await this.processEvent(event);
        } catch (error) {
          logger.error('Error processing webhook event', error as Error, { event });
        }
      }
    });

    // LINE requires 200 OK response immediately
    res.status(200).json({ received: true });
  });

  /**
   * Register a LINE group for notifications
   * POST /api/webhook/register
   */
  registerGroup = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { groupId, groupName } = req.body;
    const userId = req.userId!;

    if (!groupId) {
      res.status(400).json({ error: 'Group ID is required' });
      return;
    }

    const registration = await this.groupService.registerGroup({
      groupId,
      groupName,
      registeredBy: userId
    });

    res.json({
      success: true,
      data: registration,
      meta: {
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  });

  private verifySignature(body: any, signature: string): boolean {
    const channelSecret = authConfig.line.channelSecret;
    const hash = createHmac('SHA256', channelSecret)
      .update(JSON.stringify(body))
      .digest('base64');
    
    return hash === signature;
  }

  private async processEvent(event: any): Promise<void> {
    logger.info('Processing webhook event', { 
      type: event.type, 
      source: event.source?.type 
    });

    switch (event.type) {
      case 'message':
        await this.handleMessageEvent(event);
        break;
      
      case 'join':
        await this.handleJoinEvent(event);
        break;
      
      case 'memberJoined':
        await this.handleMemberJoinedEvent(event);
        break;
      
      case 'follow':
        await this.handleFollowEvent(event);
        break;
      
      case 'unfollow':
        await this.handleUnfollowEvent(event);
        break;
      
      default:
        logger.debug('Unhandled event type', { type: event.type });
    }
  }

  private async handleMessageEvent(event: MessageEvent): Promise<void> {
    if (event.message.type !== 'text') {
      return;
    }

    const message = event.message as TextEventMessage;
    const text = message.text.toLowerCase().trim();

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(event, text);
      return;
    }

    // Regular message handling
    logger.debug('Received text message', { 
      text, 
      userId: event.source.userId,
      groupId: (event.source as any).groupId 
    });
  }

  private async handleCommand(event: MessageEvent, command: string): Promise<void> {
    const sourceId = event.source.type === 'group' 
      ? (event.source as any).groupId 
      : event.source.userId;

    switch (command) {
      case '/register':
        if (event.source.type === 'group') {
          await this.registerGroupCommand(event);
        } else {
          await this.lineService.replyMessage(
            event.replyToken,
            'This command only works in groups.'
          );
        }
        break;

      case '/unregister':
        if (event.source.type === 'group') {
          await this.unregisterGroupCommand(event);
        }
        break;

      case '/help':
        await this.sendHelpMessage(event.replyToken);
        break;

      case '/stats':
        await this.sendStatsMessage(event.replyToken, sourceId);
        break;

      default:
        await this.lineService.replyMessage(
          event.replyToken,
          `Unknown command: ${command}. Type /help for available commands.`
        );
    }
  }

  private async registerGroupCommand(event: MessageEvent): Promise<void> {
    const groupId = (event.source as any).groupId;
    const userId = event.source.userId;

    try {
      await this.groupService.registerGroup({
        groupId,
        registeredBy: userId || 'unknown'
      });

      await this.lineService.replyMessage(
        event.replyToken,
        '✅ Group registered successfully! This group will now receive sales notifications.'
      );
    } catch (error) {
      logger.error('Failed to register group', error as Error, { groupId });
      await this.lineService.replyMessage(
        event.replyToken,
        '❌ Failed to register group. Please try again later.'
      );
    }
  }

  private async unregisterGroupCommand(event: MessageEvent): Promise<void> {
    const groupId = (event.source as any).groupId;

    try {
      await this.groupService.unregisterGroup(groupId);
      
      await this.lineService.replyMessage(
        event.replyToken,
        '✅ Group unregistered. No more notifications will be sent to this group.'
      );
    } catch (error) {
      logger.error('Failed to unregister group', error as Error, { groupId });
      await this.lineService.replyMessage(
        event.replyToken,
        '❌ Failed to unregister group. Please try again later.'
      );
    }
  }

  private async sendHelpMessage(replyToken: string): Promise<void> {
    const helpText = `
🤖 Sales Tracker Bot Commands:

/register - Register this group for notifications
/unregister - Stop receiving notifications
/stats - Show team statistics
/help - Show this help message

For the full app, visit:
https://liff.line.me/${authConfig.line.liffId}
    `.trim();

    await this.lineService.replyMessage(replyToken, helpText);
  }

  private async sendStatsMessage(replyToken: string, sourceId: string): Promise<void> {
    try {
      const stats = await this.lineService.getTeamStats('daily');
      await this.lineService.sendFlexMessage(
        sourceId,
        'Team Statistics',
        this.lineService.createLeaderboardFlexMessage(stats, 'daily')
      );
    } catch (error) {
      logger.error('Failed to send stats', error as Error);
      await this.lineService.replyMessage(
        replyToken,
        '❌ Failed to get statistics. Please try again later.'
      );
    }
  }

  private async handleJoinEvent(event: any): Promise<void> {
    logger.info('Bot joined a group', { 
      groupId: event.source.groupId 
    });

    // Send welcome message
    const welcomeMessage = `
👋 Hello! I'm the Sales Tracker Bot.

To start receiving sales notifications in this group, please have an admin type:
/register

Type /help to see all available commands.
    `.trim();

    await this.lineService.pushMessage(event.source.groupId, welcomeMessage);
  }

  private async handleMemberJoinedEvent(event: any): Promise<void> {
    logger.info('New member joined group', { 
      groupId: event.source.groupId,
      userIds: event.joined.members 
    });
  }

  private async handleFollowEvent(event: any): Promise<void> {
    logger.info('User followed bot', { 
      userId: event.source.userId 
    });

    const welcomeMessage = `
👋 Welcome to Sales Tracker!

Click the link below to open the app:
https://liff.line.me/${authConfig.line.liffId}

Track your sales activities and compete with your team! 🏆
    `.trim();

    await this.lineService.pushMessage(event.source.userId, welcomeMessage);
  }

  private async handleUnfollowEvent(event: any): Promise<void> {
    logger.info('User unfollowed bot', { 
      userId: event.source.userId 
    });
  }
}