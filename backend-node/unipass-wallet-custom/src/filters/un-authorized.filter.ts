import { Catch, UnauthorizedException } from '@nestjs/common';

@Catch(UnauthorizedException)
export class UnauthorizedExceptionFilter {
    constructor(reflector: any, logger: any) {
        this.reflector = reflector;
        this.logger = logger;
        this.logger.setContext(UnauthorizedExceptionFilter.name);
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
