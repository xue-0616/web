import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ADMIN_PREFIX } from './admin.constants';
import { AccountModule } from './account/account.module';
import { LoginModule } from './login/login.module';
import { SystemModule } from './system/system.module';
import { UnipassModule } from '../unipass/unipass.module';

@Module({
  imports: [
    AccountModule,
    LoginModule,
    SystemModule,
    UnipassModule,
    RouterModule.register([
      {
        path: ADMIN_PREFIX,
        children: [
          { path: 'account', module: AccountModule },
          { path: 'sys', module: SystemModule },
          { path: 'unipass', module: UnipassModule },
        ],
      },
      {
        path: ADMIN_PREFIX,
        module: LoginModule,
      },
    ]),
  ],
})
export class AdminModule {}
