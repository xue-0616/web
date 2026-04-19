import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { JwtStrategy } from './jwt.strategy';

@Module({
        imports: [CommonModule],
        providers: [JwtStrategy],
    })
export class AuthModule {
}
