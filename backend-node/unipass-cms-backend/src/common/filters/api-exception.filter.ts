import { Catch, ArgumentsHost, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { LoggerService } from '../../shared/logger/logger.service';
import { ApiException } from '../exceptions/api.exception';
import { ResponseDto } from '../class/res.class';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: LoggerService) {}

    catch(exception: any, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        response.header('Content-Type', 'application/json; charset=utf-8');
        const code = exception instanceof ApiException
            ? exception.getErrorCode()
            : status;
        let message = '服务器异常，请稍后再试';
        message = exception instanceof HttpException ? exception.message : `${exception}`;
        if (status >= 500) {
            this.logger.error(exception, ApiExceptionFilter.name);
        }
        const result = new ResponseDto(code, null, message);
        response.status(status).send(result);
    }
}
