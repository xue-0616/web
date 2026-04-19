import { Module } from '@nestjs/common';
import { CustomAuthModule } from '../modules/custom-auth/custom-auth.module';
import { CustomerModule } from '../modules/customer/customer.module';
import { BullModule } from '@nestjs/bull';
import { POLICY_TRANSACTION_QUEUE } from '../shared/utils/bull.name';
import { PolicyController } from './policy/policy.controller';
import { GasTankController } from './policy/gas-tank.controller';
import { PolicyService } from './policy/policy.service';

@Module({
        imports: [
            CustomAuthModule,
            CustomerModule,
            BullModule.registerQueue({ name: POLICY_TRANSACTION_QUEUE }),
        ],
        controllers: [PolicyController, GasTankController],
        providers: [PolicyService],
    })
export class OpenApiModule {
}
