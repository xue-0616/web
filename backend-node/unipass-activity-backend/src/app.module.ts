import { Module } from '@nestjs/common';
import { ActivityModule } from './modules/activity/activity.module';
import { ConfigModule } from '@nestjs/config';
import { HealthCheckerModule } from './modules/health-checker/health-checker.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from './interceptors';

@Module({
        imports: [
            ActivityModule,
            ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV === 'test' ? '.test.env' : '.env',
            }),
            HealthCheckerModule,
        ],
        providers: [
            {
                provide: APP_INTERCEPTOR,
                useClass: TransformInterceptor,
            },
        ],
    })
export class AppModule {
}
