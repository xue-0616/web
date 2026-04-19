import { ModuleMetadata } from '@nestjs/common';
import { LoggerOptions } from 'typeorm';

export type WinstonLogLevel = 'none' | 'error' | 'warn' | 'info' | 'verbose' | 'debug';

export interface LoggerModuleOptions {
  level?: WinstonLogLevel;
  consoleLevel?: WinstonLogLevel;
  timestamp?: boolean;
  maxFiles?: number;
  maxFileSize?: string;
  disableConsoleAtProd?: boolean;
  dir?: string;
  errorLogName?: string;
  appLogName?: string;
}

export interface LoggerModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<LoggerModuleOptions> | LoggerModuleOptions;
  inject?: any[];
}

export type TypeORMLoggerOptions = LoggerOptions;
