import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DbModule } from '../db/db.module';
import { BlinkService } from './blink.service';
import { ActionService } from './action/action.service';
import { BlinkController } from './blink.controller';
import { ActionController } from './action/action.controller';

@Module({
        imports: [CommonModule, DbModule],
        providers: [BlinkService, ActionService],
        controllers: [BlinkController, ActionController],
    })
export class BlinkModule {
}
