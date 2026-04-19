import { Module } from '@nestjs/common';
import { OtpModule } from './modules/otp/otp.module';
import { ReceiveEmailModule } from './modules/receive-email/receive-email.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from './shared/shared.module';
import { ApiConfigService } from './shared/services';
import { BullModule } from '@nestjs/bull';
import { AccountModule } from './modules/account/account.module';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { UpJwtModule } from './up-jwt/up-jwt.module';
import { OauthModule } from './modules/oauth/oauth.module';
import { ActionPointModule } from './modules/action-point/action-point.module';
import { DeleteAccountModule } from './modules/delete-account/delete-account.module';
import { CustomAuthModule } from './modules/custom-auth/custom-auth.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from './interceptors';
import { IpSendCodeMiddleware } from './middleware/ip.send.code.middleware';

@Module({
        imports: [
            OtpModule,
            ReceiveEmailModule,
            ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV === 'test' ? '.test.env' : '.env',
            }),
            TypeOrmModule.forRootAsync({
                imports: [SharedModule],
                useFactory: (configService) => configService.mysqlConfig,
                inject: [ApiConfigService],
            }),
            TypeOrmModule.forRootAsync({
                name: 'tss_db',
                imports: [SharedModule],
                useFactory: (configService) => configService.tssMysqlConfig,
                inject: [ApiConfigService],
            }),
            BullModule.forRootAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.queueConfig,
                inject: [ApiConfigService],
            }),
            AccountModule.forRootAsync(),
            HealthCheckerModule,
            UpJwtModule,
            OauthModule,
            ActionPointModule,
            DeleteAccountModule,
            CustomAuthModule,
        ],
        providers: [
            {
                provide: APP_INTERCEPTOR,
                useClass: TransformInterceptor,
            },
        ],
    })
export class AppModule {
    configure(consumer: any) {
            consumer.apply(IpSendCodeMiddleware).forRoutes('/oauth/send');
            consumer.apply(IpSendCodeMiddleware).forRoutes('/otp/send');
        }
}
