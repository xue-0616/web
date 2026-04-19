import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsEntity } from '../entities/accounts.entity';
import { OriHashEntity } from '../entities/ori.hash.entity';
import { AccountResolver } from './account.resolver';
import { AccountService } from './account.service';
import { AccountInfoService } from './db/account.info.service';

@Module({
        imports: [
            CommonModule,
            TypeOrmModule.forFeature([AccountsEntity, OriHashEntity], 'mainnet'),
            TypeOrmModule.forFeature([AccountsEntity, OriHashEntity], 'testnet'),
        ],
        providers: [AccountResolver, AccountService, AccountInfoService],
        exports: [AccountInfoService],
    })
export class AccountModule {
}
