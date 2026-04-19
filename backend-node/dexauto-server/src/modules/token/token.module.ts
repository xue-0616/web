import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TokenInfo } from './entities/token-info.entity';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([TokenInfo]),
        ConfigModule,
    ],
    controllers: [TokenController],
    providers: [TokenService],
    exports: [TokenService],
})
export class TokenModule {}
