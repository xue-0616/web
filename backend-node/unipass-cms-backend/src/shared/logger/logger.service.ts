import { Inject, Injectable, LoggerService as NestLoggerService, Optional } from '@nestjs/common';
import { clc, yellow } from '@nestjs/common/utils/cli-colors.util';
import { isPlainObject } from 'lodash';
import { join } from 'path';
import { createLogger, format, Logger as WinstonLogger, transports } from 'winston';
import { isDev } from '../../config/env';
import {
  DEFAULT_ERROR_LOG_NAME,
  DEFAULT_MAX_SIZE,
  DEFAULT_WEB_LOG_NAME,
  LOGGER_MODULE_OPTIONS,
  PROJECT_LOG_DIR_NAME,
} from './logger.constants';
import { LoggerModuleOptions, WinstonLogLevel } from './logger.interface';
import { getAppRootPath } from './utils/app-root-path.util';

const DEFAULT_LOG_CONSOLE_LEVELS: WinstonLogLevel = isDev() ? 'info' : 'error';
const DEFAULT_LOG_WINSTON_LEVELS: WinstonLogLevel = 'info';
const LOG_LEVEL_VALUES: Record<Exclude<WinstonLogLevel, 'none'>, number> = {
  debug: 4,
  verbose: 3,
  info: 2,
  warn: 1,
  error: 0,
};

@Injectable()
export class LoggerService implements NestLoggerService {
  private static lastTimestampAt?: number;
  private readonly context?: string;
  private readonly options: LoggerModuleOptions;
  private readonly logDir: string;
  private readonly winstonLogger: WinstonLogger;

  constructor(
    @Optional() context?: string,
    @Optional() @Inject(LOGGER_MODULE_OPTIONS) options: LoggerModuleOptions = {},
  ) {
    this.context = context;
    this.options = {
      timestamp: true,
      level: DEFAULT_LOG_WINSTON_LEVELS,
      consoleLevel: DEFAULT_LOG_CONSOLE_LEVELS,
      maxFileSize: DEFAULT_MAX_SIZE,
      appLogName: DEFAULT_WEB_LOG_NAME,
      errorLogName: DEFAULT_ERROR_LOG_NAME,
      ...options,
    };
    this.logDir = this.options.dir ?? join(getAppRootPath(), PROJECT_LOG_DIR_NAME);
    this.winstonLogger = this.initWinston();
  }

  private initWinston(): WinstonLogger {
    const transportOptions = {
      dirname: this.logDir,
      maxSize: this.options.maxFileSize,
      maxFiles: this.options.maxFiles,
    };
    const webTransport = new transports.File({ ...transportOptions, filename: this.options.appLogName });
    const errorTransport = new transports.File({ ...transportOptions, filename: this.options.errorLogName, level: 'error' });
    return createLogger({
      level: this.options.level === 'none' ? 'error' : this.options.level,
      format: format.json({ space: 0 }),
      levels: LOG_LEVEL_VALUES,
      transports: [webTransport, errorTransport],
    });
  }

  getLogDir(): string {
    return this.logDir;
  }

  getWinstonLogger(): WinstonLogger {
    return this.winstonLogger;
  }

  log(message: any, ...optionalParams: any[]): void {
    this.printAndRecord('info', message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]): void {
    this.printAndRecord('error', message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]): void {
    this.printAndRecord('warn', message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]): void {
    this.printAndRecord('debug', message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]): void {
    this.printAndRecord('verbose', message, ...optionalParams);
  }

  private printAndRecord(logLevel: Exclude<WinstonLogLevel, 'none'>, message: any, ...optionalParams: any[]): void {
    const { messages, context, stack } = this.getContextAndStackAndMessagesToPrint([message, ...optionalParams]);
    if (this.isConsoleLevelEnabled(logLevel)) {
      this.printMessages(messages, context, logLevel, logLevel === 'error' ? 'stderr' : 'stdout');
      if (logLevel === 'error') {
        this.printStackTrace(stack);
      }
    }
    if (this.isWinstonLevelEnabled(logLevel)) {
      this.recordMessages(messages, context, logLevel, stack);
    }
  }

  private isConsoleLevelEnabled(level: Exclude<WinstonLogLevel, 'none'>): boolean {
    if (!isDev() && this.options.disableConsoleAtProd) {
      return false;
    }
    if (!this.options.consoleLevel || this.options.consoleLevel === 'none') {
      return false;
    }
    return LOG_LEVEL_VALUES[level] <= LOG_LEVEL_VALUES[this.options.consoleLevel as Exclude<WinstonLogLevel, 'none'>];
  }

  private isWinstonLevelEnabled(level: Exclude<WinstonLogLevel, 'none'>): boolean {
    if (!this.options.level || this.options.level === 'none') {
      return false;
    }
    return LOG_LEVEL_VALUES[level] <= LOG_LEVEL_VALUES[this.options.level as Exclude<WinstonLogLevel, 'none'>];
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private recordMessages(messages: any[], context = '', logLevel: Exclude<WinstonLogLevel, 'none'> = 'info', stack?: string): void {
    messages.forEach((message) => {
      const output = isPlainObject(message)
        ? JSON.stringify(message, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 0)
        : String(message);
      this.winstonLogger.log(logLevel, output, {
        context,
        stack,
        pid: process.pid,
        timestamp: this.getTimestamp(),
      });
    });
  }

  private printMessages(
    messages: any[],
    context = '',
    logLevel: Exclude<WinstonLogLevel, 'none'> = 'info',
    writeStreamType: 'stdout' | 'stderr' = 'stdout',
  ): void {
    const color = this.getColorByLogLevel(logLevel);
    messages.forEach((message) => {
      const output = isPlainObject(message)
        ? `${color('Object:')}\n${JSON.stringify(message, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)}\n`
        : color(String(message));
      const pidMessage = color(`[Nest] ${process.pid}  - `);
      const contextMessage = context ? yellow(`[${context}] `) : '';
      const timestampDiff = this.updateAndGetTimestampDiff();
      const formattedLogLevel = color(logLevel.toUpperCase().padStart(7, ' '));
      const computedMessage = `${pidMessage}${this.getTimestamp()} ${formattedLogLevel} ${contextMessage}${output}${timestampDiff}\n`;
      process[writeStreamType].write(computedMessage);
    });
  }

  private printStackTrace(stack?: string): void {
    if (!stack) {
      return;
    }
    process.stderr.write(`${stack}\n`);
  }

  private updateAndGetTimestampDiff(): string {
    const includeTimestamp = LoggerService.lastTimestampAt && this.options.timestamp;
    const result = includeTimestamp ? yellow(` +${Date.now() - (LoggerService.lastTimestampAt as number)}ms`) : '';
    LoggerService.lastTimestampAt = Date.now();
    return result;
  }

  private getContextAndMessagesToPrint(args: any[]): { messages: any[]; context: string } {
    if (args.length <= 1) {
      return { messages: args, context: this.context ?? '' };
    }
    const lastElement = args[args.length - 1];
    if (typeof lastElement !== 'string') {
      return { messages: args, context: this.context ?? '' };
    }
    return {
      context: lastElement,
      messages: args.slice(0, args.length - 1),
    };
  }

  private getContextAndStackAndMessagesToPrint(
    args: any[],
  ): { messages: any[]; context: string; stack?: string } {
    const { messages, context } = this.getContextAndMessagesToPrint(args);
    if (messages.length <= 1) {
      return { messages, context };
    }
    const lastElement = messages[messages.length - 1];
    if (typeof lastElement !== 'string') {
      return { messages, context };
    }
    return {
      stack: lastElement,
      messages: messages.slice(0, messages.length - 1),
      context,
    };
  }

  private getColorByLogLevel(level: Exclude<WinstonLogLevel, 'none'>) {
    switch (level) {
      case 'debug':
        return clc.magentaBright;
      case 'warn':
        return clc.yellow;
      case 'error':
        return clc.red;
      case 'verbose':
        return clc.cyanBright;
      default:
        return clc.green;
    }
  }
}
