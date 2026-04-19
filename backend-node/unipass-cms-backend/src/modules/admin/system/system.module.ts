import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import SysConfig from '../../../entities/default/admin/sys-config.entity';
import SysDepartment from '../../../entities/default/admin/sys-department.entity';
import SysLoginLog from '../../../entities/default/admin/sys-login-log.entity';
import SysMenu from '../../../entities/default/admin/sys-menu.entity';
import SysRoleDepartment from '../../../entities/default/admin/sys-role-department.entity';
import SysRoleMenu from '../../../entities/default/admin/sys-role-menu.entity';
import SysRole from '../../../entities/default/admin/sys-role.entity';
import SysTaskLog from '../../../entities/default/admin/sys-task-log.entity';
import SysTask from '../../../entities/default/admin/sys-task.entity';
import SysUserRole from '../../../entities/default/admin/sys-user-role.entity';
import SysUser from '../../../entities/default/admin/sys-user.entity';
import { SharedModule } from '../../../shared/shared.module';
import { WSModule } from '../../ws/ws.module';
import { SysDeptController } from './dept/dept.controller';
import { SysDeptService } from './dept/dept.service';
import { SysLogController } from './log/log.controller';
import { SysLogService } from './log/log.service';
import { SysMenuController } from './menu/menu.controller';
import { SysMenuService } from './menu/menu.service';
import { SysOnlineController } from './online/online.controller';
import { SysOnlineService } from './online/online.service';
import { SysParamConfigController } from './param-config/param-config.controller';
import { SysParamConfigService } from './param-config/param-config.service';
import { SysRoleController } from './role/role.controller';
import { SysRoleService } from './role/role.service';
import { SysServeController } from './serve/serve.controller';
import { SysServeService } from './serve/serve.service';
import { SysTaskController } from './task/task.controller';
import { SysTaskService } from './task/task.service';
import { SysUserController } from './user/user.controller';
import { SysUserService } from './user/user.service';

@Module({
  imports: [
    SharedModule,
    WSModule,
    TypeOrmModule.forFeature(
      [
        SysUser,
        SysDepartment,
        SysRole,
        SysMenu,
        SysRoleMenu,
        SysUserRole,
        SysRoleDepartment,
        SysLoginLog,
        SysTask,
        SysTaskLog,
        SysConfig,
      ],
      'default',
    ),
  ],
  controllers: [
    SysDeptController,
    SysLogController,
    SysMenuController,
    SysOnlineController,
    SysParamConfigController,
    SysRoleController,
    SysServeController,
    SysTaskController,
    SysUserController,
  ],
  providers: [
    SysDeptService,
    SysLogService,
    SysMenuService,
    SysOnlineService,
    SysParamConfigService,
    SysRoleService,
    SysServeService,
    SysTaskService,
    SysUserService,
  ],
  exports: [SysUserService],
})
export class SystemModule {}
