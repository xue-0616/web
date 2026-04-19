import { ArgumentsHost, Catch, ExceptionFilter, UnprocessableEntityException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppLoggerService } from '../common/utils.service/logger.service';

@Catch(UnprocessableEntityException)
export class HttpExceptionFilter implements ExceptionFilter<UnprocessableEntityException> {
    constructor(reflector: Reflector, private readonly logger: AppLoggerService) {
        this.reflector = reflector;
        this.logger.setContext(HttpExceptionFilter.name);
    }
    reflector: Reflector;
    catch(exception: UnprocessableEntityException, host: ArgumentsHost): void {
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const statusCode = exception.getStatus();
            const r = exception.getResponse() as any;
            const validationErrors = r.message;
            this.validationFilter(validationErrors);
            response.status(statusCode).json(r);
        }
    validationFilter(validationErrors: any) {
            this.logger.warn(`validationErrors ${JSON.stringify(validationErrors)}`);
        }
}
