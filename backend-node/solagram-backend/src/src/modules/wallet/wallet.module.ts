import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AppController } from './app.controller';

@Module({
        imports: [CommonModule],
        providers: [WalletService],
        controllers: [WalletController, AppController],
    })
export class WalletModule {
}
