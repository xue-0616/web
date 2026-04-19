import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Favorite } from './entities/favorite.entity';
import { FavoriteService } from './favorite.service';
import { FavoriteController } from './favorite.controller';
import { TokenModule } from '../token/token.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([Favorite]), ConfigModule, TokenModule, AuthModule],
    controllers: [FavoriteController],
    providers: [FavoriteService],
    exports: [FavoriteService],
})
export class FavoriteModule {}
