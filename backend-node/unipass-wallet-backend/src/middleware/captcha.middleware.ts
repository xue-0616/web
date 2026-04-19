import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MSG, StatusName } from '../shared/utils';

@Injectable()
export class CaptchaMiddleware {
    constructor(logger: any, ipReCaptchaService: any) {
        this.logger = logger;
        this.ipReCaptchaService = ipReCaptchaService;
        this.logger.setContext(CaptchaMiddleware.name);
    }
    logger: any;
    ipReCaptchaService: any;
    async use(req: any, res: any, next: any) {
            const response = req.headers[MSG.TURNSTILE_TOKEN];
            const ip = req.ip;
            const path = req.originalUrl;
            if (!response) {
                throw new UnauthorizedException(MSG.TURNSTILE_TOKEN_NOT_FIND);
            }
            const isVerified = await this.ipReCaptchaService.verifyCloudflareCaptchaResponse(response, ip);
            if (!isVerified) {
                this.logger.warn(`response verify error path= ${path},ip=${ip}`);
                throw new BadRequestException(StatusName.CAPTCHA_VERIFY_ERROR);
            }
            next();
        }
}
