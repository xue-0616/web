import { AbstractLogger, LogLevel, LogMessage, QueryRunner } from 'typeorm';
import { AppLoggerService } from './logger.service';

export class MyCustomLogger extends AbstractLogger {
    constructor(private readonly logger: AppLoggerService) {
        super();
        this.logger.setContext(MyCustomLogger.name);
    }
    writeLog(level: LogLevel, logMessage: LogMessage | LogMessage[], queryRunner: QueryRunner): void {
            const messages = this.prepareLogMessages(logMessage, {
                highlightSql: false,
            });
            for (let message of messages) {
                switch (message.type ?? level) {
                    case 'warn':
                    case 'query-slow':
                        if (message.prefix) {
                            this.logger.warn(`${message.prefix},${message.message}`);
                        }
                        else {
                            this.logger.warn(`${message.message}`);
                        }
                        break;
                    case 'error':
                    case 'query-error':
                        if (message.prefix) {
                            this.logger.error(`${message.prefix},${message.message}`);
                        }
                        else {
                            this.logger.error(`${message.message}`);
                        }
                        break;
                }
            }
        }
}
