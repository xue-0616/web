import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomAuthAccountsEntity } from './entities/custom-auth.accounts.entity';
import { CustomAuthAppInfoEntity } from './entities/custom-auth.app.info.entity';
import { AccountModule } from '../account/account.module';
import { ActionPointModule } from '../action-point/action-point.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService } from '../../shared/services';
import { CustomAuthService } from './custom-auth.service';
import { CustomAuthAppInfoDbService } from './custom-auth.app.info.db.service';
import { CustomAuthDBService } from './custom-auth.db.service';
import { CustomAuthAdminService } from './admin/custom-auth.admin.service';
import { CustomAuthController } from './custom-auth.controller';
import { CustomAuthTssController } from './custom-auth.tss.controller';
import { CustomAuthAdminController } from './admin/custom-auth.admin.controller';

@Module({
        imports: [
            TypeOrmModule.forFeature([
                CustomAuthAccountsEntity,
                CustomAuthAppInfoEntity,
            ]),
            AccountModule,
            ActionPointModule,
            JwtModule.registerAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.jwtConfig,
                inject: [ApiConfigService],
            }),
        ],
        providers: [
            CustomAuthService,
            CustomAuthAppInfoDbService,
            CustomAuthDBService,
            CustomAuthAdminService,
        ],
        exports: [CustomAuthDBService, CustomAuthAppInfoDbService],
        controllers: [
            CustomAuthController,
            CustomAuthTssController,
            CustomAuthAdminController,
        ],
    })
export class CustomAuthModule {
}
