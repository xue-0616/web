import { AppLoggerService } from '../shared/services';
import { ArgumentsHost, Catch, ExceptionFilter, UnprocessableEntityException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Recovered from dist/bad-request.filter.js.map (source: ../../src/filters/bad-request.filter.ts)

@Catch(UnprocessableEntityException)
export class HttpExceptionFilter implements ExceptionFilter {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(HttpExceptionFilter.name);
    }

    catch(exception: UnprocessableEntityException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const statusCode = exception.getStatus();
        const r = exception.getResponse() as any;
        const validationErrors = r.message;
        this.validationFilter(validationErrors);
        response.status(statusCode).json(r);
    }

    private validationFilter(validationErrors: any[]): void {
        if (!validationErrors) return;
        this.logger.warn(`validationErrors ${JSON.stringify(validationErrors)}`);
        for (const validationError of validationErrors) {
            const children = validationError.children;
            if (children && children.length > 0) {
                this.validationFilter(children);
                return;
            }
            delete validationError.children;
            const constraints = validationError.constraints;
            if (!constraints) {
                return;
            }
        }
    }
}
