import { BadRequestException, Catch } from '@nestjs/common';
import { getResponseData } from '../shared/utils';

@Catch(BadRequestException)
export class BadHttpErrorExceptionFilter {
    constructor(reflector: any, logger: any) {
        this.reflector = reflector;
        this.logger = logger;
        this.logger.setContext(BadHttpErrorExceptionFilter.name);
    }
    reflector: any;
    logger: any;
    catch(exception: any, host: any) {
            const r = exception.getResponse();
            const errorInfo = getResponseData(r.message);
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const status = exception.getStatus();
            this.logger.warn(`errorInfo = ${JSON.stringify(errorInfo)}`);
            response.status(status).json(Object.assign({}, errorInfo));
        }
}
