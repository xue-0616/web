import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ApiConfigService } from '../../shared/services';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomAuthAccountsEntity } from './entities/custom-auth.accounts.entity';
import { CustomAuthAppInfoEntity } from './entities/custom-auth.app.info.entity';
import { KeyListEntity } from './entities/key.list.entity';
import { OriHashEntity } from './entities/ori.hash.entity';
import { CustomAuthService } from './custom-auth.service';
import { CustomAuthAppInfoDbService } from './custom-auth.app.info.db.service';
import { CustomAuthDBService } from './custom-auth.db.service';
import { CustomAuthAdminService } from './admin/custom-auth.admin.service';
import { KeyDBService } from './key/key.db.service';
import { KeyService } from './key/key.service';
import { OriHashDBService } from './key/ori.hash.db.service';
import { QueryAbiService } from './key/query-abi.service';
import { TssService } from './key/tss.service';
import { CustomAuthController } from './custom-auth.controller';
import { CustomAuthTssController } from './custom-auth.tss.controller';
import { CustomAuthAdminController } from './admin/custom-auth.admin.controller';

@Module({
        imports: [
            JwtModule.registerAsync({
                imports: [ConfigModule],
                useFactory: (configService) => configService.jwtConfig,
                inject: [ApiConfigService],
            }),
            TypeOrmModule.forFeature([
                CustomAuthAccountsEntity,
                CustomAuthAppInfoEntity,
                KeyListEntity,
                OriHashEntity,
            ]),
        ],
        providers: [
            CustomAuthService,
            CustomAuthAppInfoDbService,
            CustomAuthDBService,
            CustomAuthAdminService,
            KeyDBService,
            KeyService,
            OriHashDBService,
            QueryAbiService,
            TssService,
        ],
        exports: [CustomAuthDBService, CustomAuthAppInfoDbService, QueryAbiService],
        controllers: [
            CustomAuthController,
            CustomAuthTssController,
            CustomAuthAdminController,
        ],
    })
export class CustomAuthModule {
}
