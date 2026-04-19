import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeletedAccountEntity } from './entities/deleted-accounts.entity';
import { DeleteAccountService } from './delete-account.service';
import { DeleteAccountController } from './delete-account.controller';

@Module({
        imports: [TypeOrmModule.forFeature([DeletedAccountEntity])],
        providers: [DeleteAccountService],
        controllers: [DeleteAccountController],
    })
export class DeleteAccountModule {
}
