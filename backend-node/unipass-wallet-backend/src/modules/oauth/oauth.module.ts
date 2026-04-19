import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService } from '../../shared/services';
import { AccountModule } from '../account/account.module';
import { OauthController } from './oauth.controller';
import { OauthService } from './oauth.service';
import { AWSService } from './aws.cognito.service';

@Module({
        imports: [
            OtpModule,
            JwtModule.registerAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.jwtConfig,
                inject: [ApiConfigService],
            }),
            AccountModule,
        ],
        controllers: [OauthController],
        providers: [OauthService, AWSService],
        exports: [OauthService],
    })
export class OauthModule {
}
