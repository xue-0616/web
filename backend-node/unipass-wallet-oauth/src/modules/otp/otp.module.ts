// Recovered from dist/otp.module.js.map (source: ../../../src/modules/otp/otp.module.ts)
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { SEND_EMAIL_QUEUE } from '../../shared/utils';
import { IpreCaptchaService } from './ip.recaptcha.service';
import { SendEmailProcessor } from './processor/send.code.processor';
import { OtpCodeBaseService } from './service/otp.base.service';
import { SendEmailService } from './service/send.email.service';

@Module({
    imports: [BullModule.registerQueue({ name: SEND_EMAIL_QUEUE })],
    providers: [OtpCodeBaseService, IpreCaptchaService, SendEmailService, SendEmailProcessor],
    exports: [OtpCodeBaseService, IpreCaptchaService],
})
export class OtpModule {}
