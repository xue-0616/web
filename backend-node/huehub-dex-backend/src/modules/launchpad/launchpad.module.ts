import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { RgbppModule } from '../rgbpp/rgbpp.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LaunchpadRoundEntity } from '../../database/entities/launchpad.rounds.entity';
import { LaunchpadTokenEntity } from '../../database/entities/launchpad.tokens.entity';
import { MintHistoryEntity } from '../../database/entities/mint.history.entity';
import { WhitelistEntity } from '../../database/entities/whitelist.entity';
import { BullModule } from '@nestjs/bull';
import { QUEUE_LAUNCHPAD_TX } from '../../common/utils/bull.name';
import { BtcModule } from '../btc/btc.module';
import { LaunchpadController } from './launchpad.controller';
import { IssueController } from './issue.controller';
import { LaunchpadService } from './launchpad.service';
import { LaunchpadRoundsDbService, LaunchpadTokensDbService, MintHistotyDbService, WhitelistDbService } from './db.service';
import { LaunchpadTransactionService } from './launchpad.transaction.service';
import { LaunchpadTransactionProcessor } from './processor/launchpad.processor';
import { LaunchpadTaskService } from './launchpad.task.service';

@Module({
        imports: [
            CommonModule,
            RgbppModule,
            TypeOrmModule.forFeature([
                LaunchpadRoundEntity,
                LaunchpadTokenEntity,
                MintHistoryEntity,
                WhitelistEntity,
            ]),
            BullModule.registerQueue({ name: QUEUE_LAUNCHPAD_TX }),
            BtcModule,
        ],
        controllers: [LaunchpadController, IssueController],
        providers: [
            LaunchpadService,
            LaunchpadRoundsDbService,
            LaunchpadTokensDbService,
            WhitelistDbService,
            MintHistotyDbService,
            LaunchpadTransactionService,
            LaunchpadTransactionProcessor,
            LaunchpadTaskService,
        ],
    })
export class LaunchpadModule {
}
