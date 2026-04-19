import SysRoleDepartment from '../../../../entities/default/admin/sys-role-department.entity';
import SysRoleMenu from '../../../../entities/default/admin/sys-role-menu.entity';
import SysRole from '../../../../entities/default/admin/sys-role.entity';

export class RoleInfo {
    roleInfo!: SysRole | null;
    menus!: SysRoleMenu[];
    depts!: SysRoleDepartment[];
}

export class CreatedRoleId {
    roleId!: number;
}
