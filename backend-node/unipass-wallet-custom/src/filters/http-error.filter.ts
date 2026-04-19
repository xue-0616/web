import { Catch, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class ErrorExceptionFilter {
    constructor(reflector: any, logger: any) {
        this.reflector = reflector;
        this.logger = logger;
        this.logger.setContext(ErrorExceptionFilter.name);
    }
    reflector: any;
    logger: any;
    catch(exception: any, host: any) {
            const r = exception.getResponse();
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const status = exception.getStatus();
            this.logger.warn(`errorInfo = ${r.message}`);
            response.status(status).json({
                message: r.message,
                status,
            });
        }
}
