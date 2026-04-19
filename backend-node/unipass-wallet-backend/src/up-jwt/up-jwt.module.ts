import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AccountModule } from '../modules/account/account.module';
import { CustomAuthModule } from '../modules/custom-auth/custom-auth.module';
import { UpJwtStrategy } from './up-jwt.strategy';

@Module({
        imports: [
            PassportModule.register({ defaultStrategy: 'jwt' }),
            AccountModule,
            CustomAuthModule,
        ],
        providers: [UpJwtStrategy],
    })
export class UpJwtModule {
}
