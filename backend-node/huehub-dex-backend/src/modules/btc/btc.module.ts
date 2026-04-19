import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { CkbModule } from '../ckb/ckb.module';
import { BtcService } from './btc.service';
import { BtcAssetsService } from './btc.assets.service';
import { BtcController } from './btc.controller';

@Module({
        imports: [CommonModule, CkbModule],
        providers: [BtcService, BtcAssetsService],
        controllers: [BtcController],
        exports: [BtcService, BtcAssetsService],
    })
export class BtcModule {
}
