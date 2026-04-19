import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BotStatisticsModule } from '../bot-statistics/bot-statistics.module';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { TgUserService } from './tg-user.service';
import { TgUserController } from './tg-user.controller';
import { MiniAppController } from './mini-app.controller';

@Module({
        imports: [
            CommonModule,
            BotStatisticsModule,
            JwtModule.registerAsync({
                imports: [CommonModule],
                inject: [AppConfigService],
                useFactory: async (appConfigService) => appConfigService.jwtConfig,
            }),
        ],
        providers: [TgUserService],
        controllers: [TgUserController, MiniAppController],
    })
export class TgUserModule {
}
