// Recovered from dist/oauth2.module.js.map (source: ../../../src/modules/oauth2/oauth2.module.ts)
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiConfigService } from '../../shared/services';
import { SEND_EMAIL_QUEUE } from '../../shared/utils';
import { OtpModule } from '../otp/otp.module';
import { OAuth2Controller } from './oauth2.controller';
import { OAuth2DBService } from './oauth2.db.service';
import { OAuth2ClientEntity } from './entities/oauth2.client.entity';
import { OAuth2EmailEntity } from './entities/oauth2.email.entity';
import { OAuth2Service } from './oauth2.service';

@Module({
    imports: [
        BullModule.registerQueue({ name: SEND_EMAIL_QUEUE }),
        OtpModule,
        TypeOrmModule.forFeature([OAuth2ClientEntity, OAuth2EmailEntity]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ApiConfigService) => configService.jwtConfig,
            inject: [ApiConfigService],
        }),
    ],
    providers: [OAuth2Service, OAuth2DBService],
    controllers: [OAuth2Controller],
    exports: [OAuth2Service],
})
export class OAuth2Module {}
