import { AppLoggerService } from '../shared/services';
import { getResponseData } from '../shared/utils';
import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Recovered from dist/http-error.filter.js.map (source: ../../src/filters/http-error.filter.ts)

@Catch(BadRequestException)
export class HttpErrorExceptionFilter implements ExceptionFilter {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(HttpErrorExceptionFilter.name);
    }

    catch(exception: BadRequestException, host: ArgumentsHost): void {
        const r = exception.getResponse() as any;
        const errorInfo = getResponseData(r.message);
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const status = exception.getStatus();
        this.logger.warn(`errorInfo = ${JSON.stringify(errorInfo)}`);
        response.status(status).json(Object.assign({}, errorInfo));
    }
}
