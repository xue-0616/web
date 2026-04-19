import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../../common/common.module';
import { TgUserEntity } from '../../database/entities/tg-user.entity';
import { TgUserController } from './tg-user.controller';
import { TgUserService } from './tg-user.service';
import { TgUserDBService } from './tg-user-db.service';

@Module({
    imports: [CommonModule, TypeOrmModule.forFeature([TgUserEntity])],
    controllers: [TgUserController],
    providers: [TgUserService, TgUserDBService],
})
export class TgUserModule {}
