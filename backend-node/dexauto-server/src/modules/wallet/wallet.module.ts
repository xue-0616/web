import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Wallet } from './entities/wallet.entity';
import { User } from '../user/entities/user.entity';
import { WalletOrderStatistic } from './entities/walletOrderStatistic.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { KmsModule } from '../kms/kms.module';
import { TokenModule } from '../token/token.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Wallet, User, WalletOrderStatistic]),
        ConfigModule,
        KmsModule,
        TokenModule,
    ],
    controllers: [WalletController],
    providers: [WalletService],
    exports: [WalletService],
})
export class WalletModule {}
