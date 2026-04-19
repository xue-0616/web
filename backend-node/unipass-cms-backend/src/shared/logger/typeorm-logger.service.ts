import { Logger as TypeORMLogger, LoggerOptions } from 'typeorm';
import { LoggerModuleOptions } from './logger.interface';
import { Injectable } from '@nestjs/common';
import { DEFAULT_SQL_ERROR_LOG_NAME, DEFAULT_SQL_SLOW_LOG_NAME } from './logger.constants';
import { LoggerService } from './logger.service';

@Injectable()
export class TypeORMLoggerService implements TypeORMLogger {
    private readonly logger: LoggerService;
    constructor(
        private readonly options: LoggerOptions,
        private readonly config: LoggerModuleOptions,
    ) {
        this.logger = new LoggerService(TypeORMLoggerService.name, {
            level: 'warn',
            consoleLevel: 'verbose',
            appLogName: DEFAULT_SQL_SLOW_LOG_NAME,
            errorLogName: DEFAULT_SQL_ERROR_LOG_NAME,
            timestamp: this.config.timestamp,
            dir: this.config.dir,
            maxFileSize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles,
        });
    }
    logQuery(query: any, parameters: any): void {
        if (this.options === 'all' ||
            this.options === true ||
            (Array.isArray(this.options) && this.options.indexOf('query') !== -1)) {
            const sql = query +
                (parameters && parameters.length
                    ? ' -- PARAMETERS: ' + this.stringifyParams(parameters)
                    : '');
            this.logger.verbose('[QUERY]: ' + sql);
        }
    }
    logQueryError(error: any, query: any, parameters: any): void {
        if (this.options === 'all' ||
            this.options === true ||
            (Array.isArray(this.options) && this.options.indexOf('error') !== -1)) {
            const sql = query +
                (parameters && parameters.length
                    ? ' -- PARAMETERS: ' + this.stringifyParams(parameters)
                    : '');
            this.logger.error([`[FAILED QUERY]: ${sql}`, `[QUERY ERROR]: ${error}`]);
        }
    }
    logQuerySlow(time: any, query: any, parameters: any): void {
        const sql = query +
            (parameters && parameters.length
                ? ' -- PARAMETERS: ' + this.stringifyParams(parameters)
                : '');
        this.logger.warn(`[SLOW QUERY: ${time} ms]: ` + sql);
    }
    logSchemaBuild(message: any): void {
        if (this.options === 'all' ||
            (Array.isArray(this.options) && this.options.indexOf('schema') !== -1)) {
            this.logger.verbose(message);
        }
    }
    logMigration(message: any): void {
        this.logger.verbose(message);
    }
    log(level: any, message: any): void {
        switch (level) {
            case 'log':
                if (this.options === 'all' ||
                    (Array.isArray(this.options) && this.options.indexOf('log') !== -1))
                    this.logger.verbose('[LOG]: ' + message);
                break;
            case 'info':
                if (this.options === 'all' ||
                    (Array.isArray(this.options) && this.options.indexOf('info') !== -1))
                    this.logger.log('[INFO]: ' + message);
                break;
            case 'warn':
                if (this.options === 'all' ||
                    (Array.isArray(this.options) && this.options.indexOf('warn') !== -1))
                    this.logger.warn('[WARN]: ' + message);
                break;
        }
    }
    stringifyParams(parameters: any) {
        try {
            return JSON.stringify(parameters);
        }
        catch (error) {
            return parameters;
        }
    }
}
