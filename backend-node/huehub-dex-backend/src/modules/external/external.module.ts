import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { RgbppModule } from '../rgbpp/rgbpp.module';
import { ExternalController } from './external.controller';
import { ExternalService } from './external.service';

@Module({
        imports: [CommonModule, RgbppModule],
        controllers: [ExternalController],
        providers: [ExternalService],
    })
export class ExternalModule {
}
