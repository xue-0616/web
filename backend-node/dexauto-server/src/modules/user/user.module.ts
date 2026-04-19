import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { TradingModule } from '../trading/trading.module';
import { TransferSyncerModule } from '../transfer-syncer/transfer-syncer.module';
import { AutomaticStrategyModule } from '../automatic-strategy/automatic-strategy.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        ConfigModule,
        WalletModule,
        AuthModule,
        // forwardRef: TradingService / AutomaticStrategyService form cycles
        // with UserService (both sides inject @Inject(forwardRef(...))).
        forwardRef(() => TradingModule),
        TransferSyncerModule,
        forwardRef(() => AutomaticStrategyModule),
    ],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}
