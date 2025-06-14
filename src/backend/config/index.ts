// Centralized configuration management

import { config as dotenvConfig } from 'dotenv';
import { AppError, ErrorCode } from '@shared/utils/errors';

// Load environment variables
dotenvConfig();

export interface DatabaseConfig {
  type: 'firestore' | 'sqlite';
  sqlite?: {
    path: string;
  };
  firestore?: {
    projectId?: string;
    keyFile?: string;
  };
}

export interface AuthConfig {
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  google: {
    clientId: string;
    clientSecret?: string;
  };
  line: {
    channelId: string;
    channelSecret: string;
    channelAccessToken: string;
    liffId: string;
  };
}

export interface ServerConfig {
  port: number;
  env: 'development' | 'staging' | 'production';
  apiVersion: string;
  corsOrigins: string[];
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  bodyLimit: string;
}

export interface ServicesConfig {
  line: {
    apiUrl: string;
    quotaLimit: number;
  };
  google: {
    apiUrl: string;
  };
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  services: ServicesConfig;
  features: {
    demoMode: boolean;
    aiAssistant: boolean;
    webhooks: boolean;
  };
  logging: {
    level: string;
    format: 'json' | 'text';
  };
}

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): Config {
    return {
      server: {
        port: parseInt(process.env.PORT || '10000', 10),
        env: (process.env.NODE_ENV as any) || 'development',
        apiVersion: process.env.API_VERSION || 'v1',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8000'],
        rateLimiting: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
        },
        bodyLimit: process.env.BODY_LIMIT || '10mb'
      },
      database: {
        type: (process.env.DB_TYPE as any) || 'firestore',
        sqlite: {
          path: process.env.SQLITE_PATH || '/tmp/sales-tracker.db'
        },
        firestore: {
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS
        }
      },
      auth: {
        jwt: {
          secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
          expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
        },
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        },
        line: {
          channelId: process.env.LINE_CHANNEL_ID || '',
          channelSecret: process.env.LINE_CHANNEL_SECRET || '',
          channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
          liffId: process.env.LIFF_ID || '2007552096-wrG1aV9p'
        }
      },
      services: {
        line: {
          apiUrl: 'https://api.line.me/v2',
          quotaLimit: parseInt(process.env.LINE_QUOTA_LIMIT || '500', 10)
        },
        google: {
          apiUrl: 'https://www.googleapis.com'
        }
      },
      features: {
        demoMode: process.env.ENABLE_DEMO_MODE === 'true',
        aiAssistant: process.env.ENABLE_AI_ASSISTANT === 'true',
        webhooks: process.env.ENABLE_WEBHOOKS !== 'false'
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: (process.env.LOG_FORMAT as any) || 'json'
      }
    };
  }

  private validateConfig(): void {
    const { auth, server } = this.config;

    // Validate required fields for production
    if (server.env === 'production') {
      if (!auth.line.channelSecret || !auth.line.channelAccessToken) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          'LINE credentials are required in production'
        );
      }

      if (auth.jwt.secret === 'your-secret-key-change-in-production') {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          'JWT secret must be changed in production'
        );
      }
    }
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  getAll(): Config {
    return { ...this.config };
  }

  isProduction(): boolean {
    return this.config.server.env === 'production';
  }

  isDevelopment(): boolean {
    return this.config.server.env === 'development';
  }
}

// Export singleton instance
export const config = new ConfigManager();

// Export specific configurations for convenience
export const serverConfig = config.get('server');
export const databaseConfig = config.get('database');
export const authConfig = config.get('auth');
export const servicesConfig = config.get('services');