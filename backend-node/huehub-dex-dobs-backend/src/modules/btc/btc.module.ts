import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BtcService } from './btc.service';
import { BtcAssetsService } from './btc.assets.service';

@Module({
        imports: [CommonModule],
        providers: [BtcService, BtcAssetsService],
        exports: [BtcService, BtcAssetsService],
    })
export class BtcModule {
}
