import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { BlinkService } from './blink.service';
import { BlinkController } from './blink.controller';

@Module({
        imports: [CommonModule],
        providers: [BlinkService],
        controllers: [BlinkController],
    })
export class BlinkModule {
}
