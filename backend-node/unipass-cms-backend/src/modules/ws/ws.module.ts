import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import SysRoleMenu from '../../entities/default/admin/sys-role-menu.entity';
import SysUserRole from '../../entities/default/admin/sys-user-role.entity';
import { AdminWSGateway } from './admin-ws.gateway';
import { AuthService } from './auth.service';
import { AdminWSService } from './admin-ws.service';

const providers = [AdminWSGateway, AuthService, AdminWSService];

@Module({
  imports: [JwtModule.register({}), TypeOrmModule.forFeature([SysRoleMenu, SysUserRole], 'default')],
  providers,
  exports: providers,
})
export class WSModule {}
