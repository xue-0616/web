import { Injectable } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { MSG } from '../shared/utils';

@Injectable()
export class TransformInterceptor {
    constructor(logger: any) {
        this.logger = logger;
        this.logger.setContext(TransformInterceptor.name);
    }
    logger: any;
    intercept(ctx: any, next: any) {
            const now = Date.now();
            const req = ctx.switchToHttp().getRequest();
            const method = req.method;
            const url = req.url;
            const body = req.body;
            const query = req.query;
            const ip = req._remoteAddress;
            if (url !== '/api/v1/price-conversion' &&
                url !== '/api/v1/chainbase/account.tokens' &&
                url !== '/api/v1/config') {
                this.logger.log(`${method} ${url} ${method !== 'GET' ? JSON.stringify(body) : JSON.stringify(query)} ${ip}`);
            }
            return next.handle().pipe(map((data) => {
                const res = { data, statusCode: 200, message: MSG.SUCCESS };
                if (url !== '/api/v1/account/token/price' &&
                    url !== '/api/v1/account/erc20/tokens' &&
                    url !== '/api/v1/config' &&
                    url !== '/api/v1/account/recovery/guardian.email.status') {
                    this.logger.log(`[- ${ip} -] ${method} ${url} [${Date.now() - now}ms], data = ${method !== 'GET' ? JSON.stringify(body) : JSON.stringify(query)}, return = ${JSON.stringify(res)} =`);
                }
                if (url.includes('guardian.verify')) {
                    return data;
                }
                return res;
            }));
        }
}
