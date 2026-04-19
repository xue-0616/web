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
                this.logger.error(`[path]:${response.req.path},errorInfo = ${exception?.stack},body = ${JSON.stringify(response.req.body)} user = ${JSON.stringify(response.req.user)}`);
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
                        this.logger.error(`[path]:${response.req.path},errorInfo = ${JSON.stringify(errorInfo)},body = ${JSON.stringify(response.req.body)} user = ${JSON.stringify(response.req.user)}`);
                        const status = 200;
                        response.status(status).json({
                            ...errorInfo,
                        });
                    }
                    else {
                        const exceptionResponse = exception.getResponse();
                        this.logger.error(`[path]:${response.req.path},errorInfo = ${JSON.stringify(exceptionResponse)},body = ${JSON.stringify(response.req.body)} user = ${JSON.stringify(response.req.user)}`);
                        response.status(status).json(exceptionResponse);
                    }
                }
                else {
                    this.logger.error(`[path]:${response.req.path},unknown error = ${JSON.stringify(exception.message)},body = ${JSON.stringify(response.req.body)} user = ${JSON.stringify(response.req.user)}`);
                    response.status(status).json({
                        statusCode: status,
                        message: exception.message || 'unknown error',
                    });
                }
            }
        }
}
