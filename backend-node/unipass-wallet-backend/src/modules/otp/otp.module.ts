import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SEND_EMAIL_QUEUE } from '../../shared/utils';
import { OtpCodeBaseService } from './service/otp.base.service';
import { OtpService } from './otp.service';
import { GoogleAuthenticatorsService } from './google.authenticators.service';
import { PhoneService } from './phone.service';
import { IpreCaptchaService } from './ip.recaptcha.service';
import { OptOauthService } from './opt.oauth.service';

const providers = [
    OtpCodeBaseService,
    OtpService,
    GoogleAuthenticatorsService,
    PhoneService,
    IpreCaptchaService,
    OptOauthService,
];

@Module({
        imports: [BullModule.registerQueue({ name: SEND_EMAIL_QUEUE })],
        providers,
        exports: [
            OtpCodeBaseService,
            OtpService,
            GoogleAuthenticatorsService,
            PhoneService,
            IpreCaptchaService,
            OptOauthService,
        ],
    })
export class OtpModule {
}
