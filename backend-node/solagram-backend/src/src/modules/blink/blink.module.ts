import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlinkShortCodeEntity } from '../../database/entities/blink-short-code.entity';
import { BlinkService } from './blink.service';
import { ParseBlinkService } from './parse.blink.service';
import { BlinkShortCodeDBService } from './blink-short-code-db.service';
import { BlinkController } from './blink.controller';

@Module({
        imports: [CommonModule, TypeOrmModule.forFeature([BlinkShortCodeEntity])],
        providers: [BlinkService, ParseBlinkService, BlinkShortCodeDBService],
        exports: [ParseBlinkService, BlinkShortCodeDBService],
        controllers: [BlinkController],
    })
export class BlinkModule {
}
