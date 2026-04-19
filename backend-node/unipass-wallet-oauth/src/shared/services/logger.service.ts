// Recovered from dist/logger.service.js.map (source: ../../../src/shared/services/logger.service.ts)
import { Injectable, LoggerService, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context?: string;

  setContext(context: string): void {
    this.context = context;
  }

  error(message: unknown, trace?: unknown, context?: unknown): void {
    console.error(this.format('error', message, context ?? trace));
  }

  warn(message: unknown, context?: unknown): void {
    console.warn(this.format('warn', message, context));
  }

  debug(message: unknown, context?: unknown): void {
    console.debug(this.format('debug', message, context));
  }

  verbose(message: unknown, context?: unknown): void {
    console.info(this.format('verbose', message, context));
  }

  log(message: unknown, context?: unknown): void {
    console.info(this.format('log', message, context));
  }

  private format(level: string, message: unknown, context?: unknown): string {
    const ctx = this.context ? `[${this.context}]` : '';
    const extra = context !== undefined ? ` ${JSON.stringify(context)}` : '';
    return `${new Date().toISOString()} ${level.toUpperCase()} ${ctx} ${String(message)}${extra}`.trim();
  }
}
