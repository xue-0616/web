import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { ActivityService } from './activity.service';
import { ChainService } from './abi.service';
import { ActivityController } from './activity.controller';

@Module({
        imports: [SharedModule],
        providers: [ActivityService, ChainService],
        exports: [ChainService],
        controllers: [ActivityController],
    })
export class ActivityModule {
}
