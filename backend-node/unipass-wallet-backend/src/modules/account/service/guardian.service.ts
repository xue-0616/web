import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { SEND_EMAIL_QUEUE, SEND_GUARDIAN_EMAIL_JOB, TIME, decodeBase64, getEmailBuriedName, isMatchDkimEmailSuffixes, matchEmailFormat } from '../../../shared/utils';
import { OtpAction } from '../../otp/dtos';
import { RequestContext } from '../../../interfaces';

@Injectable()
export class GuardianService {
    constructor(redisService: any, otpCodeBaseService: any, logger: any, unipassConfigService: any, @InjectQueue(SEND_EMAIL_QUEUE) sendEmailQueue: any) {
        this.redisService = redisService;
        this.otpCodeBaseService = otpCodeBaseService;
        this.logger = logger;
        this.unipassConfigService = unipassConfigService;
        this.sendEmailQueue = sendEmailQueue;
        this.logger.setContext(GuardianService.name);
    }
    redisService: any;
    otpCodeBaseService: any;
    logger: any;
    unipassConfigService: any;
    sendEmailQueue: any;
    async senGuardianLink(account: any, sendGuardianLinkInput: any) {
            const { provider } = account;
            const action = OtpAction.SendGuardian;
            const { email } = sendGuardianLinkInput;
            matchEmailFormat(email, this.logger);
            isMatchDkimEmailSuffixes(email, this.logger);
            const key = `send_${email}_${provider}_${action}`;
            await this.otpCodeBaseService.getSendCodeTimes(key);
            const ctx = new RequestContext();
            const code = await this.otpCodeBaseService.getSendCode(ctx, action, `${email}_${provider}`);
            await this.otpCodeBaseService.saveSendCodeTimes(new RequestContext(), key);
            await this.sendEmailQueue.add(SEND_GUARDIAN_EMAIL_JOB, {
                ctx,
                email,
                action,
                registerEmail: account.email,
                provider,
                code,
            });
            await this.saveEmailGuardian(account.email, email, provider);
        }
    async verifyGuardian(ctx: any, verifyGuardianInput: any) {
            const { data } = verifyGuardianInput;
            if (!data) {
                return;
            }
            const emailData = decodeURIComponent(data);
            const debase64 = decodeBase64(emailData);
            let verifyData;
            try {
                verifyData = JSON.parse(debase64);
            }
            catch (error) {
                this.logger.warn(`[verifyGuardian] ${error},data = ${debase64}`);
                return;
            }
            const { code, email, action, registerEmail, provider } = verifyData;
            this.logger.log(`[verifyGuardian] ${JSON.stringify({ email, registerEmail, provider })}`);
            await this.otpCodeBaseService.validateOtpCode(ctx, action, `${email}_${provider}`, code);
            await this.otpCodeBaseService.generateUpAuthToken(`${email}_${provider}`, action, ctx, `${registerEmail}_${provider}`);
            this.logger.log(`buried point event = ${getEmailBuriedName.addGuardianEmail}, data = ${JSON.stringify(data)}, email=${registerEmail}_${provider}, emailFrom =${email}`);
        }
    async getGuardianStatus(account: any) {
            const tokenData = [];
            const emails = await this.getEmailGuardian(account);
            for (const email of emails) {
                const isWhiteList = this.unipassConfigService.isTestWhiteList(email);
                this.logger.log(`[getGuardianStatus] GuardianService: isWhiteList = ${isWhiteList} `);
                if (!isWhiteList) {
                    const upAuthToken = await this.otpCodeBaseService.getUpAuthToken(OtpAction.SendGuardian, `${email}_${account.provider}`, `${account.email}_${account.provider}`);
                    tokenData.push({
                        verified: upAuthToken ? true : false,
                        email,
                    });
                }
                else {
                    tokenData.push({
                        verified: true,
                        email,
                    });
                }
            }
            return tokenData;
        }
    async getEmailGuardian(account: any) {
            const { email, provider } = account;
            const key = `guardian_${email}_${provider}`;
            const cacheData = await this.redisService.getCacheData(key);
            const emails = cacheData ? cacheData.split(',') : [];
            return emails;
        }
    async saveEmailGuardian(registerEmail: any, email: any, provider: any) {
            const key = `guardian_${registerEmail}_${provider}`;
            let cacheData = await this.redisService.getCacheData(key);
            const emails = cacheData ? cacheData.split(',') : [];
            if (emails.includes(email)) {
                return;
            }
            emails.push(email);
            cacheData = emails.join(',');
            await this.redisService.saveCacheData(key, cacheData, TIME.HALF_HOUR);
        }
}
