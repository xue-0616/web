// Recovered from dist/send.email.service.js.map (source: ../../../../src/modules/otp/service/send.email.service.ts)
import { Injectable } from '@nestjs/common';
import { RequestContext, TemplateType } from '../../../interfaces';
import { ApiConfigService, AppLoggerService, EmailService } from '../../../shared/services';

@Injectable()
export class SendEmailService {
    constructor(
        private readonly logger: AppLoggerService,
        private readonly apiConfigService: ApiConfigService,
        private readonly emailService: EmailService,
    ) {}

    async sendEmailVerificationCode(ctx: RequestContext, email: string, code: string, templateType: TemplateType): Promise<void> {
        try {
            const otpConfig = this.apiConfigService.getOtpConfig as any;
            await this.emailService.createAndSendEmail(
                ctx,
                code,
                templateType,
                otpConfig.subjectPrefix || 'UniPass Verification Code',
                otpConfig.mailFrom,
                email,
            );
        } catch (error) {
            this.logger.error(`[sendEmailVerificationCode] ${error}`, ctx);
        }
    }
}
