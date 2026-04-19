import { BadRequestException, Injectable } from '@nestjs/common';
import { StatusName, TIME } from '../shared/utils';

@Injectable()
export class IpSendCodeMiddleware {
    constructor(logger: any, redisService: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.logger.setContext(IpSendCodeMiddleware.name);
    }
    logger: any;
    redisService: any;
    async use(req: any, res: any, next: any) {
            const ip = req.ip;
            const path = req.originalUrl;
            const key = `sendCode:${ip}`;
            const isSend = await this.redisService.getCacheData(key);
            if (isSend) {
                this.logger.warn(`[sendCode] ip ${ip} too frequent path = ${path}`);
                throw new BadRequestException(StatusName.OPERATION_FREQUENT);
            }
            await this.redisService.saveCacheData(key, 'true', TIME.ONE_MINUTE);
            next();
        }
}
