import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppLoggerService } from '../common/utils-service/logger.service';
import { getResponseData } from '../common/utils/error.code';

@Catch(BadRequestException)
export class HttpErrorExceptionFilter implements ExceptionFilter {
    constructor(reflector: Reflector, private readonly logger: AppLoggerService) {
        this.reflector = reflector;
        this.logger.setContext(HttpErrorExceptionFilter.name);
    }
    reflector: Reflector;
    catch(exception: BadRequestException, host: ArgumentsHost): void {
            const r = exception.getResponse() as any;
            const errorInfo = getResponseData(r.message);
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const status = 200;
            this.logger.error(`[path]:${response.req.path},errorInfo = ${JSON.stringify(errorInfo)},body = ${JSON.stringify(response.req.body)} user = ${JSON.stringify(response.req.user)}`);
            response.status(status).json({
                ...errorInfo,
            });
        }
}
