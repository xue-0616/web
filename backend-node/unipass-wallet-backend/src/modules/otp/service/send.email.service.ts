import { Injectable } from '@nestjs/common';
import { MSG, encodeBase64 } from '../../../shared/utils';
import { TemplateType } from '../../../interfaces';

@Injectable()
export class SendEmailService {
    constructor(logger: any, apiConfigService: any, emailService: any) {
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.emailService = emailService;
        this.logger.setContext(SendEmailService.name);
    }
    logger: any;
    apiConfigService: any;
    emailService: any;
    async sendEmailVerificationCode(ctx: any, email: any, code: any) {
            const subject = MSG.SUBJECT_CODE;
            const from = this.apiConfigService.getOtpConfig.mailFrom;
            const to = email;
            try {
                await this.emailService.createAndSendEmail(ctx, code, TemplateType.code, subject, from, to);
            }
            catch (error) {
                this.logger.warn(`[sendEmailVerification] ${error}, data=${JSON.stringify({
                    to,
                    subject,
                    code,
                })}`);
            }
        }
    async sendGuardianEmail(ctx: any, email: any, code: any, action: any, registerEmail: any, provider: any) {
            const guardianUrl = this.generateGuardianUrl(ctx, email, code, action, registerEmail, provider);
            const subject = MSG.SUBJECT_GUARDIAN;
            const from = this.apiConfigService.getOtpConfig.mailFrom;
            const to = email;
            try {
                await this.emailService.createAndSendEmail(ctx, guardianUrl, TemplateType.verifyUrl, subject, from, to, registerEmail);
            }
            catch (error) {
                this.logger.warn(`[sendEmailVerificationUrl]${error}, data = ${JSON.stringify({
                    to,
                    subject,
                    guardianUrl,
                })}`);
            }
        }
    generateGuardianUrl(ctx: any, email: any, code: any, action: any, registerEmail: any, provider: any) {
            const verifyData = {
                code,
                registerEmail,
                email,
                action,
                provider,
            };
            const enBase64 = encodeBase64(JSON.stringify(verifyData));
            const guardianUrl = `${this.apiConfigService.getOtpConfig.apiHostUrl}/account/guardian.verify?data=${encodeURIComponent(enBase64)}`;
            this.logger.log(`[generateGuardianUrl] SendEmailService send url:${guardianUrl}`, ctx);
            return guardianUrl;
        }
}
