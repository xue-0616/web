import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PaymasterController } from './paymaster.controller';
import { PaymasterService } from './paymaster.service';
import { SignService } from './sign.service';
import { CandidateCellManagerService } from './candidate-cell-manager.service';
import { LiquidityPoolService } from './liquidity-pool.service';
import { ApiKeyGuard } from '../../guards/api-key.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';

@Module({
  imports: [CommonModule],
  controllers: [PaymasterController],
  providers: [
    PaymasterService,
    SignService,
    CandidateCellManagerService,
    LiquidityPoolService,
    ApiKeyGuard,
    RateLimitGuard,
  ],
})
export class PaymasterModule {}
