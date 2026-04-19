import { Injectable, Scope } from '@nestjs/common';
import winston_daily_rotate_file from 'winston-daily-rotate-file';
import { createLogger, format, transports } from 'winston';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService {
    constructor() {
        this.switch = process.env.LOGS_JSON_SWITCH || 'false';
        this.logger = createLogger({
            transports: [new transports.Console()],
        });
        const myFormat = this.switch === 'true' ? format.json() : format.prettyPrint();
        this.logger = createLogger({
            transports: [
                new transports.Console(),
                new winston_daily_rotate_file({
                    filename: 'logs/%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                }),
            ],
            format: format.combine(format.splat(), format.timestamp(), myFormat),
        });
    }
    switch: any;
    logger: any;
    context: any;
    setContext(context: any) {
            this.context = context;
        }
    error(message: any, ctx: any, meta: any) {
            const timestamp = new Date().toISOString();
            return this.logger.error(Object.assign({ message, contextName: this.context, timestamp,
                ctx }, meta));
        }
    warn(message: any, meta: any) {
            const timestamp = new Date().toISOString();
            return this.logger.warn(Object.assign({ message, contextName: this.context, timestamp }, meta));
        }
    debug(ctx: any, message: any, meta: any) {
            const timestamp = new Date().toISOString();
            return this.logger.debug(Object.assign({ message, contextName: this.context, timestamp,
                ctx }, meta));
        }
    verbose(ctx: any, message: any, meta: any) {
            const timestamp = new Date().toISOString();
            return this.logger.verbose(Object.assign({ message, contextName: this.context, timestamp,
                ctx }, meta));
        }
    log(message: any, ctx: any, meta: any) {
            const timestamp = new Date().toISOString();
            return this.logger.info(Object.assign({ message, contextName: this.context, timestamp,
                ctx }, meta));
        }
}
