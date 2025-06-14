// Centralized logging utility

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  service?: string;
  [key: string]: any;
}

class Logger {
  private level: LogLevel;
  private service: string;

  constructor(service: string = 'sales-tracker', level?: LogLevel) {
    this.service = service;
    this.level = level ?? this.getLogLevelFromEnv();
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    return LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${this.service}] [${level}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(levelName, message, context);

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }

    // In production, send to external logging service
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(level, message, context);
    }
  }

  private sendToLoggingService(level: LogLevel, message: string, context?: LogContext): void {
    // TODO: Implement integration with Google Cloud Logging or similar service
    // This is where you'd send logs to your centralized logging system
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };
    this.log(LogLevel.ERROR, 'ERROR', message, errorContext);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, 'TRACE', message, context);
  }

  // Create a child logger with additional context
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.service, this.level);
    const originalLog = childLogger.log.bind(childLogger);
    
    childLogger.log = (level: LogLevel, levelName: string, message: string, ctx?: LogContext) => {
      originalLog(level, levelName, message, { ...context, ...ctx });
    };

    return childLogger;
  }

  // Performance logging
  startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${operation} completed`, { duration, operation });
    };
  }
}

// Export singleton instance for backend
export const logger = new Logger();

// Export factory for creating service-specific loggers
export function createLogger(service: string, level?: LogLevel): Logger {
  return new Logger(service, level);
}