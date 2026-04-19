import { Catch } from '@nestjs/common';

@Catch(Error)
export class ErrorFilter {
    constructor(reflector: any, logger: any) {
        this.reflector = reflector;
        this.logger = logger;
        this.logger.setContext(ErrorFilter.name);
    }
    reflector: any;
    logger: any;
    catch(error: any, host: any) {
            const message = error.message;
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const status = 500;
            this.logger.error(`[ErrorFilter] = ${message} url = ${response.req.url} query = ${JSON.stringify(response.req.query)} body = ${JSON.stringify(response.req.body)} `);
            response.status(status).json({
                message,
                status,
            });
        }
}
