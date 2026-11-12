// ==============================================================
// LINKEDIN AUTOPILOT - STRUCTURED LOGGING ENGINE
// BY GT INNOX LLP
// ==============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  event: string;
  context?: string;
  workspaceId?: string;
  userId?: string;
  postId?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private format(level: LogLevel, event: string, details?: Partial<StructuredLog>): string {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...details,
    };
    return JSON.stringify(log);
  }

  debug(event: string, details?: Partial<StructuredLog>) {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.debug(`[DEBUG] ${this.format('debug', event, details)}`);
    }
  }

  info(event: string, details?: Partial<StructuredLog>) {
    console.info(`[INFO] ${this.format('info', event, details)}`);
  }

  warn(event: string, details?: Partial<StructuredLog>) {
    console.warn(`[WARN] ${this.format('warn', event, details)}`);
  }

  error(event: string, error?: Error | any, details?: Partial<StructuredLog>) {
    const errorDetails = error
      ? {
          message: error.message || String(error),
          stack: error.stack,
          code: error.code,
        }
      : undefined;

    console.error(
      `[ERROR] ${this.format('error', event, {
        ...details,
        error: errorDetails,
      })}`
    );
  }
}

export const logger = new Logger();
