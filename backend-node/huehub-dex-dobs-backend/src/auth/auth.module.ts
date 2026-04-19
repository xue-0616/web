import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UserModule } from '../modules/user/user.module';
import { JwtStrategy } from './jwt.strategy';

@Module({
        imports: [CommonModule, UserModule],
        providers: [JwtStrategy],
    })
export class AuthModule {
}
