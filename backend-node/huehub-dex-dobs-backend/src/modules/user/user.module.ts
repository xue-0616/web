import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { IndexerModule } from '../indexer/indexer.module';
import { BtcModule } from '../btc/btc.module';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { MarketModule } from '../market/market.module';
import { JwtModule } from '@nestjs/jwt';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
        imports: [
            CollectionModule,
            IndexerModule,
            BtcModule,
            ConfigModule,
            CommonModule,
            MarketModule,
            JwtModule.registerAsync({
                imports: [CommonModule],
                inject: [AppConfigService],
                useFactory: async (appConfigService) => appConfigService.jwtConfig,
            }),
        ],
        controllers: [UserController],
        providers: [UserService],
        exports: [UserService],
    })
export class UserModule {
}
