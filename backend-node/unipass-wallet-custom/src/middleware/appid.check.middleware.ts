import { Injectable } from '@nestjs/common';
import { MSG } from '../shared/utils';

@Injectable()
export class AppIdCheckMiddleware {
    constructor(logger: any) {
        this.logger = logger;
        this.logger.setContext(AppIdCheckMiddleware.name);
    }
    logger: any;
    use(req: any, res: any, next: any) {
            const path = req.originalUrl;
            const appId = req.headers['x-up-app-id'];
            const ip = req.ip;
            if (!appId) {
                let data = this.getNullAppIdRequestData(path);
                const statusCode = 200;
                const resData = { data, statusCode, message: MSG.SUCCESS };
                this.logger.warn(`[- ${ip} -] ${req.method} ${path} ${JSON.stringify(req.body)}[AppIdCheckMiddleware] appId not find return = ${JSON.stringify(resData)}`);
                return res.status(statusCode).json(resData);
            }
            next();
        }
    getNullAppIdRequestData(path: any) {
            switch (path) {
                case '/api/v1/open-api/policy/gas-fee-adjustment':
                    return { adjustment: 100 };
                case '/api/v1/open-api/policy/verify-transaction':
                    return { isPolicyTransaction: false };
                case '/api/v1/open-api/gas-tank/consume-gas':
                    return { success: false };
            }
        }
}
