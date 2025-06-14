// Main server file with refactored architecture

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { initializeApp } from 'firebase-admin/app';
import { config, serverConfig } from './config';
import { logger } from '@shared/utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authenticate, optionalAuth, demoAuth } from './middleware/auth.middleware';
import { AuthController } from './controllers/auth.controller';
import { ActivityController } from './controllers/activity.controller';
import { UserController } from './controllers/user.controller';
import { TeamController } from './controllers/team.controller';
import { WebhookController } from './controllers/webhook.controller';
import { ActivityService } from './services/activity.service';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

export class Server {
  private app: Application;
  private server: any;
  private io: SocketServer | null = null;
  private activityService: ActivityService;

  constructor() {
    this.app = express();
    this.activityService = new ActivityService();
    this.initializeFirebase();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSocket();
  }

  private initializeFirebase(): void {
    try {
      initializeApp();
      logger.info('Firebase initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firebase', error as Error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false // Disable for LIFF compatibility
    }));

    // CORS configuration
    this.app.use(cors({
      origin: serverConfig.corsOrigins,
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: serverConfig.bodyLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: serverConfig.bodyLimit }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: serverConfig.rateLimiting.windowMs,
      max: serverConfig.rateLimiting.maxRequests,
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('Request processed', {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration,
          ip: req.ip
        });
      });
      next();
    });

    // Demo mode middleware
    if (config.get('features').demoMode) {
      this.app.use(demoAuth);
    }
  }

  private setupRoutes(): void {
    const router = express.Router();

    // Controllers
    const authController = new AuthController();
    const activityController = new ActivityController();
    const userController = new UserController();
    const teamController = new TeamController();
    const webhookController = new WebhookController();

    // Health check
    router.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // Auth routes
    router.post('/auth/login', authController.login);
    router.post('/auth/logout', authenticate, authController.logout);
    router.get('/auth/me', authenticate, authController.getProfile);
    router.put('/auth/me', authenticate, authController.updateProfile);
    router.post('/auth/refresh', authController.refreshToken);

    // Activity routes
    router.post('/activities', authenticate, activityController.create);
    router.get('/activities', authenticate, activityController.getUserActivities);
    router.get('/activities/stats', authenticate, activityController.getStats);
    router.get('/activities/recent', optionalAuth, activityController.getRecent);
    router.get('/activities/:id', authenticate, activityController.getById);
    router.put('/activities/:id', authenticate, activityController.update);
    router.delete('/activities/:id', authenticate, activityController.delete);

    // User routes
    router.get('/users', authenticate, userController.list);
    router.get('/users/:id', authenticate, userController.getById);
    router.get('/users/:id/activities', authenticate, userController.getActivities);
    router.get('/users/:id/achievements', authenticate, userController.getAchievements);

    // Team routes
    router.get('/team/stats', optionalAuth, teamController.getStats);
    router.get('/team/leaderboard/:period', optionalAuth, teamController.getLeaderboard);

    // Webhook routes (LINE)
    router.post('/webhook', webhookController.handleWebhook);
    router.post('/webhook/register', authenticate, webhookController.registerGroup);

    // Mount routes
    this.app.use('/api', router);

    // Serve API documentation
    if (config.isDevelopment()) {
      this.app.use('/docs', express.static('docs'));
    }
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  private setupWebSocket(): void {
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: serverConfig.corsOrigins,
        credentials: true
      }
    });

    // WebSocket authentication
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const userService = new (await import('./services/user.service')).UserService();
        const payload = await userService.verifyToken(token);
        socket.data.userId = payload.userId;
        socket.data.user = payload;
        
        next();
      } catch (err) {
        next(new Error('Authentication error'));
      }
    });

    // WebSocket connection handling
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      logger.info('WebSocket client connected', { userId, socketId: socket.id });

      // Join user's room
      socket.join(`user:${userId}`);

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { userId, socketId: socket.id });
      });
    });

    // Listen to activity service events
    this.activityService.on('activity:created', ({ activity, user }) => {
      // Notify user
      this.io.to(`user:${user.id}`).emit('activity:created', activity);
      
      // Notify all users for leaderboard updates
      this.io.emit('leaderboard:update', { userId: user.id });
    });

    this.activityService.on('activity:updated', ({ activity }) => {
      this.io.to(`user:${activity.userId}`).emit('activity:updated', activity);
    });

    this.activityService.on('activity:deleted', ({ activityId, userId }) => {
      this.io.to(`user:${userId}`).emit('activity:deleted', { activityId });
    });
  }

  public start(): void {
    const port = serverConfig.port;

    this.server.listen(port, () => {
      logger.info(`Server started`, {
        port,
        env: serverConfig.env,
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down server...');

    // Close WebSocket connections
    if (this.io) {
      this.io.close();
    }

    // Close HTTP server
    this.server.close(() => {
      logger.info('Server shut down successfully');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}