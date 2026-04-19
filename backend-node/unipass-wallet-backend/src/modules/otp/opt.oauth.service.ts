import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { SEND_EMAIL_CODE_JOB, SEND_EMAIL_QUEUE, StatusName } from '../../shared/utils';
import { RequestContext } from '../../interfaces/RequestContext';
import { OtpAction } from './dtos';

@Injectable()
export class OptOauthService {
    constructor(logger: any, otpCodeBaseService: any, @InjectQueue(SEND_EMAIL_QUEUE) sendEmailQueue: any) {
        this.logger = logger;
        this.otpCodeBaseService = otpCodeBaseService;
        this.sendEmailQueue = sendEmailQueue;
        this.logger.setContext(OptOauthService.name);
    }
    logger: any;
    otpCodeBaseService: any;
    sendEmailQueue: any;
    async sendEmailCode(email: any) {
            const key = `kms_${email}`;
            const ctx = new RequestContext();
            await this.otpCodeBaseService.getSendCodeTimes(key);
            const code = await this.otpCodeBaseService.getSendCode(ctx, OtpAction.Login, key);
            await this.otpCodeBaseService.saveSendCodeTimes(ctx, key);
            this.logger.log(`[sendEmailCode] key= ${key} code=${code}`);
            await this.sendEmailQueue.add(SEND_EMAIL_CODE_JOB, {
                ctx,
                email,
                code,
            });
        }
    async verifyEmailCode(key: any, code: any) {
            const ctx = new RequestContext();
            const codeData = await this.otpCodeBaseService.updateVerifyCodeData(ctx, OtpAction.Login, key);
            this.logger.log(`[verifyEmailCode] codeData= ${JSON.stringify(codeData)}, code = ${code}`);
            if ((codeData === null || codeData === void 0 ? void 0 : codeData.code) !== code) {
                throw new BadRequestException(StatusName.OTP_CODE_ERROR);
            }
            await this.otpCodeBaseService.removeCacheKey(`otc_${OtpAction.Login}_${key}`);
        }
}
