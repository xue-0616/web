import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppLoggerService } from '../common/utils-service/logger.service';
import { getResponseData } from '../common/utils/error.code';

@Catch(Error)
export class ErrorExceptionFilter implements ExceptionFilter {
    constructor(reflector: Reflector, private readonly logger: AppLoggerService) {
        this.reflector = reflector;
        this.logger.setContext(ErrorExceptionFilter.name);
    }
    reflector: Reflector;
    catch(exception: Error, host: ArgumentsHost): void {
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const status = exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;
            if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
                this.showLog(response.req.path, JSON.stringify({ body: response.req.body, query: response.req.query }), exception?.stack);
                response.status(status).json({
                    statusCode: status,
                    message: 'unknown error',
                });
            }
            else {
                if (exception instanceof HttpException) {
                    const r = exception.getResponse() as any;
                    const errorInfo = getResponseData(r.message);
                    const ctx = host.switchToHttp();
                    if (status === HttpStatus.BAD_REQUEST) {
                        const response = ctx.getResponse();
                        this.showLog(response.req.path, JSON.stringify({
                            body: response.req.body,
                            query: response.req.query,
                        }), JSON.stringify(errorInfo));
                        const status = 200;
                        response.status(status).json({
                            ...errorInfo,
                        });
                    }
                    else {
                        const exceptionResponse = exception.getResponse();
                        this.showLog(response.req.path, JSON.stringify({
                            body: response.req.body,
                            query: response.req.query,
                        }), JSON.stringify(exceptionResponse));
                        response.status(status).json(exceptionResponse);
                    }
                }
                else {
                    this.showLog(response.req.path, JSON.stringify({
                        body: response.req.body,
                        query: response.req.query,
                    }), JSON.stringify(exception.message));
                    response.status(status).json({
                        statusCode: status,
                        message: exception.message || 'unknown error',
                    });
                }
            }
        }
    showLog(url: string, body: string, exceptionStack: string | undefined): void {
            this.logger.error(`[path]:${url},errorInfo = ${exceptionStack},body = ${body} `);
        }
}
