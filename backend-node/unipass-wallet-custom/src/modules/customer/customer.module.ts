import { Module } from '@nestjs/common';
import { CustomAuthModule } from '../custom-auth/custom-auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerEntity, GasConsumptionHistoryEntity } from './entities';
import { BullModule } from '@nestjs/bull';
import { POLICY_TRANSACTION_QUEUE } from '../../shared/utils/bull.name';
import { CustomerService } from './customer.service';
import { CustomerDbService } from './customer.db.service';
import { AppService } from './app/app.service';
import { PolicyTransactionProcessor } from './processor';
import { CustomerController } from './customer.controller';
import { AppController } from './app/app.controller';

@Module({
        imports: [
            CustomAuthModule,
            TypeOrmModule.forFeature([CustomerEntity, GasConsumptionHistoryEntity]),
            BullModule.registerQueue({ name: POLICY_TRANSACTION_QUEUE }),
        ],
        providers: [
            CustomerService,
            CustomerDbService,
            AppService,
            PolicyTransactionProcessor,
        ],
        exports: [
            CustomerDbService,
            CustomerService,
            AppService,
            PolicyTransactionProcessor,
        ],
        controllers: [CustomerController, AppController],
    })
export class CustomerModule {
}
