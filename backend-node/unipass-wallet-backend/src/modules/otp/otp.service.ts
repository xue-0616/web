import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { SEND_EMAIL_CODE_JOB, SEND_EMAIL_QUEUE, SEND_PHONE_CODE_JOB, StatusName } from '../../shared/utils';
import { RequestContext } from '../../interfaces';
import { OtpAction } from './dtos';

@Injectable()
export class OtpService {
    constructor(otpCodeBaseService: any, logger: any, unipassConfigService: any, phoneService: any, @InjectQueue(SEND_EMAIL_QUEUE) sendEmailQueue: any) {
        this.otpCodeBaseService = otpCodeBaseService;
        this.logger = logger;
        this.unipassConfigService = unipassConfigService;
        this.phoneService = phoneService;
        this.sendEmailQueue = sendEmailQueue;
        this.logger.setContext(OtpService.name);
    }
    otpCodeBaseService: any;
    logger: any;
    unipassConfigService: any;
    phoneService: any;
    sendEmailQueue: any;
    async sendCode(sendOtpCodeInput: any, account: any) {
            const { action, bindPhone } = sendOtpCodeInput;
            await ((bindPhone === null || bindPhone === void 0 ? void 0 : bindPhone.phone) !== undefined
                ? this.sendPhoneCode(new RequestContext(), action, account, bindPhone)
                : this.sendEmailCode(new RequestContext(), sendOtpCodeInput, account));
        }
    async sendEmailCode(ctx: any, sendOtpCodeInput: any, account: any) {
            const { action } = sendOtpCodeInput;
            const { email, provider } = account;
            const key = `send_${email}_${provider}_${action}`;
            await this.otpCodeBaseService.getSendCodeTimes(key);
            const code = await this.otpCodeBaseService.getSendCode(ctx, action, `${email}_${provider}`);
            await this.otpCodeBaseService.saveSendCodeTimes(ctx, key);
            if (action === OtpAction.SendGuardian) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            else {
                await this.sendEmailQueue.add(SEND_EMAIL_CODE_JOB, {
                    ctx,
                    email,
                    code,
                });
            }
        }
    async sendPhoneCode(ctx: any, action: any, account: any, bindPhone: any) {
            const { email, provider } = account;
            const { phone, areaCode } = bindPhone;
            const actions = [OtpAction.BindPhone, OtpAction.Auth2Fa];
            if (!phone || !areaCode || !actions.includes(action)) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const key = `send_${email}_${provider}_${action}`;
            this.logger.log(`[sendPhoneCode] key ${key}`);
            await this.otpCodeBaseService.getSendCodeTimes(key);
            const code = await this.otpCodeBaseService.getSendCode(ctx, action, `${email}_${provider}_${areaCode}_${phone}`);
            await this.otpCodeBaseService.saveSendCodeTimes(ctx, key);
            await this.sendEmailQueue.add(SEND_PHONE_CODE_JOB, {
                ctx,
                email,
                phone,
                areaCode,
                code,
            });
        }
    async verify2FaCode(verifyOtpCodeInput: any, account: any) {
            const { bindPhone, action } = verifyOtpCodeInput;
            const actions = [OtpAction.BindPhone, OtpAction.Auth2Fa];
            const isSendPhone = actions.includes(action) && (bindPhone === null || bindPhone === void 0 ? void 0 : bindPhone.phone) !== undefined;
            this.logger.log(`[verify2FaCode] isSendPhone ${isSendPhone}`);
            const data = await (isSendPhone
                ? this.verifPhoneCode(verifyOtpCodeInput, account)
                : this.verifyOtpCode(verifyOtpCodeInput, account));
            this.logger.log(`[verify2FaCode] data ${JSON.stringify(data)}`);
            return data;
        }
    async verifyOtpCode(verifyOtpCodeInput: any, account: any) {
            const { action, code } = verifyOtpCodeInput;
            const { email, provider } = account;
            const ctx = new RequestContext();
            const isWhiteList = this.unipassConfigService.isTestWhiteList(email);
            this.logger.log(`[verifyOtpCode] OtpService: isWhiteList = ${isWhiteList} `);
            if (!isWhiteList) {
                await this.otpCodeBaseService.validateOtpCode(ctx, action, `${email}_${provider}`, code);
            }
            const upAuthToken = await this.otpCodeBaseService.generateUpAuthToken(`${email}_${provider}`, action);
            return { upAuthToken };
        }
    async verifPhoneCode(verifyOtpCodeInput: any, account: any) {
            const { bindPhone, code, action } = verifyOtpCodeInput;
            const { phone, areaCode } = bindPhone;
            const { email, provider } = account;
            const actions = [OtpAction.BindPhone, OtpAction.Auth2Fa];
            const ctx = new RequestContext();
            if (!phone || !areaCode || !actions.includes(action)) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            const key = `${email}_${provider}_${areaCode}_${phone}`;
            const isWhiteList = this.unipassConfigService.isTestWhiteList(email);
            this.logger.log(`[verifPhoneCode] OtpService: isWhiteList = ${isWhiteList} `);
            this.logger.log(`[verify2FaCode] areaCode ${areaCode}`);
            if (!isWhiteList) {
                if (areaCode === '+86') {
                    await this.otpCodeBaseService.validateOtpCode(ctx, action, key, code);
                }
                else {
                    await this.otpCodeBaseService.updateVerifyCodeData(ctx, action, key);
                    await this.phoneService.verifyAuthyPhoneCode(areaCode + phone, code);
                }
            }
            const upAuthToken = await this.otpCodeBaseService.generateUpAuthToken(`${email}_${provider}`, action, ctx, `${areaCode}_${phone}`);
            return { upAuthToken };
        }
}
