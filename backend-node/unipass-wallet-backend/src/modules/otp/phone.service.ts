import { BadRequestException, Injectable } from '@nestjs/common';
import twilio from 'twilio';
import { StatusName } from '../../shared/utils';

@Injectable()
export class PhoneService {
    constructor(logger: any, apiConfigService: any, httpService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.httpService = httpService;
        this.logger.setContext(PhoneService.name);
        this.init();
    }
    logger: any;
    apiConfigService: any;
    httpService: any;
    client: any;
    init() {
            const accountSid = this.apiConfigService.getTwilioAuthConfig.accountSid;
            const authToken = this.apiConfigService.getTwilioAuthConfig.token;
            this.client = twilio(accountSid, authToken);
        }
    async sendAuthyPhoneCode(to: any, channel: any = 'sms') {
            try {
                const verification = await this.client.verify
                    .services(this.apiConfigService.getTwilioAuthConfig.serverSid)
                    .verifications.create({ to, channel });
                this.logger.log(`[sendAuthyPhoneCode] AuthyService data verification : ${JSON.stringify(verification)}`);
            }
            catch (error) {
                this.logger.warn(`[sendAuthyPhoneCode]  ${error}, data = ${JSON.stringify({
                    to,
                    channel,
                })}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
        }
    async verifyAuthyPhoneCode(to: any, code: any) {
            try {
                const verificationCheck = await this.client.verify
                    .services(this.apiConfigService.getTwilioAuthConfig.serverSid)
                    .verificationChecks.create({ to, code });
                this.logger.log(`[verifyAuthyPhoneCode] AuthyService data verification : ${JSON.stringify(verificationCheck)}`);
                const status = verificationCheck.status;
                if (status !== 'approved') {
                    throw new BadRequestException(StatusName.OTP_CODE_ERROR);
                }
            }
            catch (error) {
                this.logger.warn(`[verifyAuthyPhoneCode]  ${error}, data=${JSON.stringify({
                    to,
                    code,
                })}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
        }
    async sendSmshy(content: any, phone: any) {
            const url = this.apiConfigService.getSMSConfig.url;
            const userid = this.apiConfigService.getSMSConfig.userid;
            const account = this.apiConfigService.getSMSConfig.account;
            const password = this.apiConfigService.getSMSConfig.password;
            const mobile = phone;
            const action = 'send';
            const data = {
                userid,
                account,
                password,
                mobile,
                content,
                action,
            };
            const params = new URLSearchParams(data);
            try {
                const result = await this.httpService
                    .post(url, params.toString(), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    },
                })
                    .toPromise();
                this.logger.log(`[sendSmshy] sms send result, ${result === null || result === void 0 ? void 0 : result.data}`);
            }
            catch (error) {
                this.logger.warn(`[sendSmshy] ${error}, data=${JSON.stringify({
                    url,
                    params,
                })}`);
            }
        }
    async sendChinaPhoneCode(phone: any, code: any) {
            const content = `验证码：${code}，请勿将验证码告知他人，并确认该申请是您本人操作，30分钟之内有效。`;
            await this.sendSmshy(content, phone);
        }
    async sendPhoneCode(sendPhone: any) {
            const { phone, areaCode, code } = sendPhone;
            await (areaCode === '+86'
                ? this.sendChinaPhoneCode(phone, code)
                : this.sendAuthyPhoneCode(areaCode + phone));
        }
}
