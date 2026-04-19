import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CustomAuthModule } from '../modules/custom-auth/custom-auth.module';
import { CustomerModule } from '../modules/customer/customer.module';
import { UpJwtStrategy } from './up-jwt.strategy';

@Module({
        imports: [
            PassportModule.register({ defaultStrategy: 'jwt' }),
            CustomAuthModule,
            CustomerModule,
        ],
        providers: [UpJwtStrategy],
    })
export class UpJwtModule {
}
