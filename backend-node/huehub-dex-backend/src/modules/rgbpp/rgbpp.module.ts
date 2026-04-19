import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BtcModule } from '../btc/btc.module';
import { CkbModule } from '../ckb/ckb.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenEntity } from '../../database/entities/token.entity';
import { TokenStatisticEntity } from '../../database/entities/token.statistic.entity';
import { ItemEntity } from '../../database/entities/item.entity';
import { OrderEntity } from '../../database/entities/order.entity';
import { DeploymentTokenEntity } from '../../database/entities/deployment.token.entity';
import { BullModule } from '@nestjs/bull';
import { QUEUE_TRANSACTION } from '../../common/utils/bull.name';
import { RgbppController } from './rgbpp.controller';
import { RgbppAssetCollectorService } from './asset.collector';
import { FixController } from './fix.controller';
import { OrderService } from './order/order.service';
import { TokensService } from './tokens/tokens.service';
import { TokenStatisticService } from './tokens/token.statistic.service';
import { ItemService } from './order/item.service';
import { RgbPPIndexerService } from './indexer.service';
import { TasksService } from './tasks.service';
import { RgbppAssetsService } from './rgbpp.service';
import { TokenProcessor } from './processor/rgbpp.processor';
import { DeploymentTokenService } from './tokens/deployment.token.service';
import { AssetService } from './asset/asset.service';
import { TokenMintService } from './tokens/token.mint.service';
import { MarketTokensService } from './tokens/market.tokens.service';
import { TokenIconEntity } from '../../database/entities/tokens.icon.entity';
import { CkbExplorerApiService } from './ckb/ckb.explorer.api.service';

@Module({
        imports: [
            CommonModule,
            BtcModule,
            CkbModule,
            TypeOrmModule.forFeature([
                TokenEntity,
                TokenStatisticEntity,
                ItemEntity,
                OrderEntity,
                DeploymentTokenEntity,
            ]),
            BullModule.registerQueue({ name: QUEUE_TRANSACTION }),
        ],
        controllers: [RgbppController, RgbppAssetCollectorService, FixController],
        providers: [
            OrderService,
            TokensService,
            TokenStatisticService,
            ItemService,
            RgbPPIndexerService,
            TasksService,
            RgbppAssetsService,
            TokenProcessor,
            DeploymentTokenService,
            AssetService,
            TokenMintService,
            MarketTokensService,
            TokenIconEntity,
            CkbExplorerApiService,
        ],
        exports: [
            TokenStatisticService,
            RgbPPIndexerService,
            TokensService,
            DeploymentTokenService,
            MarketTokensService,
            CkbExplorerApiService,
        ],
    })
export class RgbppModule {
}
