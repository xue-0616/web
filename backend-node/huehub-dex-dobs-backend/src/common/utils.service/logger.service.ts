import { Injectable, Scope } from '@nestjs/common';
import { Logger, createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService {
    constructor() {
        this.switch = process.env.logJson || 'false';
        this.logger = createLogger({
            transports: [new transports.Console()],
        });
        const myFormat = this.switch === 'true' ? format.json() : format.prettyPrint();
        this.logger = createLogger({
            transports: [
                new transports.Console(),
                new DailyRotateFile({
                    filename: 'logs/%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                }),
            ],
            format: format.combine(format.splat(), format.timestamp(), myFormat),
        });
    }
    private context: any;
    private logger: any;
    private readonly switch: any;
    setContext(context: string): void {
            this.context = context;
        }
    error(message: string, ctx?: any, meta?: Record<string, unknown>): Logger {
            const timestamp = new Date().toISOString();
            return this.logger.error({
                message,
                contextName: this.context,
                timestamp,
                ctx,
                ...meta,
            });
        }
    warn(message: string, meta?: Record<string, unknown>): Logger {
            const timestamp = new Date().toISOString();
            return this.logger.warn({
                message,
                contextName: this.context,
                timestamp,
                ...meta,
            });
        }
    debug(ctx: any, message?: string, meta?: Record<string, unknown>): Logger {
            const timestamp = new Date().toISOString();
            return this.logger.debug({
                message,
                contextName: this.context,
                timestamp,
                ctx,
                ...meta,
            });
        }
    verbose(ctx: any, message?: string, meta?: Record<string, unknown>): Logger {
            const timestamp = new Date().toISOString();
            return this.logger.verbose({
                message,
                contextName: this.context,
                timestamp,
                ctx,
                ...meta,
            });
        }
    log(message: string, ctx?: any, meta?: Record<string, unknown>): Logger {
            const timestamp = new Date().toISOString();
            return this.logger.info({
                message,
                contextName: this.context,
                timestamp,
                ctx,
                ...meta,
            });
        }
}
