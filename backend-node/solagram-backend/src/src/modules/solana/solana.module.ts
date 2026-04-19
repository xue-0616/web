import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { SolanaService } from './solana.service';
import { SolanaController } from './solana.controller';

@Module({
        imports: [CommonModule],
        providers: [SolanaService],
        controllers: [SolanaController],
    })
export class SolanaModule {
}
