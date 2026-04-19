import 'dotenv/config';
import { createLogger, format, transports, Logger } from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService {
    private logger!: Logger;
    private context?: string;
    private switch: string;

    setContext(context: string): void {
        this.context = context;
    }
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
    error(message: any, ctx?: any, meta?: any): Logger {
        const timestamp = new Date().toISOString();
        return this.logger.error({
            message,
            contextName: this.context,
            timestamp,
            ctx,
            ...meta,
        });
    }
    warn(message: any, meta?: any): Logger {
        const timestamp = new Date().toISOString();
        return this.logger.warn({
            message,
            contextName: this.context,
            timestamp,
            ...meta,
        });
    }
    debug(ctx: any, message?: any, meta?: any): Logger {
        const timestamp = new Date().toISOString();
        return this.logger.debug({
            message,
            contextName: this.context,
            timestamp,
            ctx,
            ...meta,
        });
    }
    verbose(ctx: any, message?: any, meta?: any): Logger {
        const timestamp = new Date().toISOString();
        return this.logger.verbose({
            message,
            contextName: this.context,
            timestamp,
            ctx,
            ...meta,
        });
    }
    log(message: any, ctx?: any, meta?: any): Logger {
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
