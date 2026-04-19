import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StreamGateway } from './stream.gateway';
import { StreamService } from './stream.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [ConfigModule, AuthModule],
    providers: [StreamGateway, StreamService],
    exports: [StreamService],
})
export class StreamModule {}
