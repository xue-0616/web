import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SmartWalletSourceService } from './smart-wallet-source.service';
import { ExternalWalletImportService } from './external-wallet-import.service';
import { OnchainWalletDiscoveryService } from './onchain-wallet-discovery.service';
import { WalletScorerModule } from '../wallet-scorer/wallet-scorer.module';
import { GeyserSubscriberModule } from '../geyser-subscriber/geyser-subscriber.module';
import { TokenSecurityModule } from '../token-security/token-security.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    WalletScorerModule,
    forwardRef(() => GeyserSubscriberModule),
    TokenSecurityModule,
  ],
  providers: [
    SmartWalletSourceService,
    ExternalWalletImportService,
    OnchainWalletDiscoveryService,
  ],
  exports: [
    SmartWalletSourceService,
    ExternalWalletImportService,
    OnchainWalletDiscoveryService,
  ],
})
export class SmartWalletSourceModule {}
