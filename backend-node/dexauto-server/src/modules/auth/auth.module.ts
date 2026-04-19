import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';

@Global()
@Module({
    providers: [AuthService, AuthGuard, AdminGuard],
    imports: [
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            // getOrThrow — fail loudly at boot if jwtSecret is missing, rather
            // than initialize the JwtModule with `undefined` which would make
            // every downstream sign/verify call fail at runtime with a confusing
            // error and create a security ambiguity about what key is in use.
            useFactory: (config: ConfigService) => ({
                secret: config.getOrThrow('jwtSecret'),
                signOptions: { expiresIn: '30d' },
            }),
        }),
    ],
    exports: [AuthService, AuthGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
