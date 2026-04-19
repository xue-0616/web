import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ROOT_ROLE_ID } from '../../../../modules/admin/admin.constants';

function rootRoleIdProvider() {
    return {
        provide: ROOT_ROLE_ID,
        useFactory: (configService: any) => {
            return configService.get('rootRoleId', 1);
        },
        inject: [ConfigService],
    };
}
