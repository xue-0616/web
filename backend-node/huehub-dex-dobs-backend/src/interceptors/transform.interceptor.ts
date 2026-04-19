import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { BaseApiResponse } from '../common/interface/response';
import { AppLoggerService } from '../common/utils.service/logger.service';
import { map } from 'rxjs/operators';
import { MSG } from '../common/utils/error.code';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, BaseApiResponse<T>> {
    constructor(private readonly logger: AppLoggerService) {
        this.logger.setContext(TransformInterceptor.name);
    }
    intercept(ctx: ExecutionContext, next: CallHandler): Observable<BaseApiResponse<T>> {
            const now = Date.now();
            const req = ctx.switchToHttp().getRequest();
            const method = req.method;
            const url = req.url;
            const body = req.body;
            const query = req.query;
            const ip = req._remoteAddress;
            return next.handle().pipe(map((data) => {
                const res = { data, code: 200, message: MSG.SUCCESS };
                this.logger.log(`[- ${ip} -] ${method} ${url} [${Date.now() - now}ms], data = ${method !== 'GET' ? JSON.stringify(body) : JSON.stringify(query)}, return = ${JSON.stringify(res)}, user = ${JSON.stringify(req.user)}`);
                return res;
            }));
        }
}
