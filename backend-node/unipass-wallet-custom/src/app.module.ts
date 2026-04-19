import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ApiConfigService } from './shared/services';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from './shared/shared.module';
import { APP_INTERCEPTOR, RouterModule } from '@nestjs/core';
import { OPEN_API_PREFIX } from './shared/utils';
import { OpenApiModule } from './open-api/open-api.module';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { UpJwtModule } from './up-jwt/up-jwt.module';
import { CustomAuthModule } from './modules/custom-auth/custom-auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { TransformInterceptor } from './interceptors';
import { AppIdCheckMiddleware } from './middleware/appid.check.middleware';

@Module({
        imports: [
            ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV === 'test' ? '.test.env' : '.env',
            }),
            BullModule.forRootAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.queueConfig,
                inject: [ApiConfigService],
            }),
            TypeOrmModule.forRootAsync({
                name: 'default',
                imports: [SharedModule],
                useFactory: (configService) => configService.mysqlConfig,
                inject: [ApiConfigService],
            }),
            RouterModule.register([
                {
                    path: `${OPEN_API_PREFIX}`,
                    module: OpenApiModule,
                },
            ]),
            HealthCheckerModule,
            UpJwtModule,
            CustomAuthModule,
            CustomerModule,
            OpenApiModule,
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
            consumer
                .apply(AppIdCheckMiddleware)
                .forRoutes('/open-api/policy/gas-fee-adjustment');
            consumer
                .apply(AppIdCheckMiddleware)
                .forRoutes('/open-api/policy/verify-transaction');
            consumer
                .apply(AppIdCheckMiddleware)
                .forRoutes('/open-api/gas-tank/consume-gas');
        }
}
