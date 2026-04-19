import { Module } from '@nestjs/common';
import { RgbppModule } from '../rgbpp/rgbpp.module';
import { BtcModule } from '../btc/btc.module';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
        imports: [
            RgbppModule,
            BtcModule,
            ConfigModule,
            CommonModule,
            JwtModule.registerAsync({
                imports: [CommonModule],
                inject: [AppConfigService],
                useFactory: async (appConfigService) => appConfigService.jwtConfig,
            }),
        ],
        providers: [UserService],
        controllers: [UserController],
        exports: [UserService],
    })
export class UserModule {
}
