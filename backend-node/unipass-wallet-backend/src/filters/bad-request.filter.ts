import { Catch, UnprocessableEntityException } from '@nestjs/common';
import lodash from 'lodash';

@Catch(UnprocessableEntityException)
export class HttpExceptionFilter {
    constructor(reflector: any, logger: any) {
        this.reflector = reflector;
        this.logger = logger;
        this.logger.setContext(HttpExceptionFilter.name);
    }
    reflector: any;
    logger: any;
    catch(exception: any, host: any) {
            const ctx = host.switchToHttp();
            const response = ctx.getResponse();
            const statusCode = exception.getStatus();
            const r = exception.getResponse();
            const validationErrors = r.message;
            this.validationFilter(validationErrors);
            response.status(statusCode).json(r);
        }
    validationFilter(validationErrors: any) {
            this.logger.warn(`validationErrors ${JSON.stringify(validationErrors)}`);
            for (const validationError of validationErrors) {
                const children = validationError.children;
                if (children && !lodash.isEmpty(children)) {
                    this.validationFilter(children);
                    return;
                }
                delete validationError.children;
                const constraints = validationError.constraints;
                if (!constraints) {
                    return;
                }
                for (const [constraintKey, constraint] of Object.entries(constraints)) {
                    if (!constraint) {
                        constraints[constraintKey] = `error.fields.${lodash.snakeCase(constraintKey)}`;
                    }
                }
            }
        }
}
