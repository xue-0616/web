import { Injectable, Inject } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, Not, In, Like } from 'typeorm';
import { AdminWSService } from '../../../../modules/ws/admin-ws.service';
import { CreateRoleDto, PageSearchRoleDto, UpdateRoleDto } from './role.dto';
import { CreatedRoleId, RoleInfo } from './role.class';
import SysUserRole from '../../../../entities/default/admin/sys-user-role.entity';
import SysRole from '../../../../entities/default/admin/sys-role.entity';
import SysRoleMenu from '../../../../entities/default/admin/sys-role-menu.entity';
import SysRoleDepartment from '../../../../entities/default/admin/sys-role-department.entity';
import { ROOT_ROLE_ID } from '../../admin.constants';
import { difference, filter, includes, isEmpty, map } from 'lodash';

@Injectable()
export class SysRoleService {
    constructor(
        @InjectRepository(SysRole, 'default')
        private readonly roleRepository: Repository<SysRole>,
        @InjectRepository(SysRoleMenu, 'default')
        private readonly roleMenuRepository: Repository<SysRoleMenu>,
        @InjectRepository(SysRoleDepartment, 'default')
        private readonly roleDepartmentRepository: Repository<SysRoleDepartment>,
        @InjectRepository(SysUserRole, 'default')
        private readonly userRoleRepository: Repository<SysUserRole>,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
        @Inject(ROOT_ROLE_ID)
        private readonly rootRoleId: number,
        private readonly adminWSService: AdminWSService,
    ) {}

    async list(): Promise<SysRole[]> {
        return this.roleRepository.find({ where: { id: Not(this.rootRoleId) } });
    }

    async count(): Promise<number> {
        return this.roleRepository.count({ where: { id: Not(this.rootRoleId) } });
    }

    async info(rid: number): Promise<RoleInfo> {
        const roleInfo = await this.roleRepository.findOne({ where: { id: rid } });
        const menus = await this.roleMenuRepository.find({ where: { roleId: rid } });
        const depts = await this.roleDepartmentRepository.find({ where: { roleId: rid } });
        return { roleInfo, menus, depts };
    }

    async delete(roleIds: number[]): Promise<void> {
        if (includes(roleIds, this.rootRoleId)) {
            throw new Error('Not Support Delete Root');
        }
        await this.entityManager.transaction(async (manager) => {
            await manager.delete(SysRole, roleIds);
            await manager.delete(SysRoleMenu, { roleId: In(roleIds) });
            await manager.delete(SysRoleDepartment, { roleId: In(roleIds) });
        });
    }

    async add(param: CreateRoleDto, uid: number): Promise<CreatedRoleId> {
        const { name, label, remark, menus, depts } = param;
        const role = await this.roleRepository.insert({ name, label, remark, userId: uid });
        const roleId = parseInt((role.identifiers[0] as any).id);
        if (menus && menus.length > 0) {
            await this.roleMenuRepository.insert(menus.map((m) => ({ roleId, menuId: m })));
        }
        if (depts && depts.length > 0) {
            await this.roleDepartmentRepository.insert(depts.map((d) => ({ roleId, departmentId: d })));
        }
        return { roleId };
    }

    async update(param: UpdateRoleDto): Promise<SysRole | null> {
        const { roleId, name, label, remark, menus, depts } = param;
        const role = await this.roleRepository.save({ id: roleId, name, label, remark });
        const originDeptRows = await this.roleDepartmentRepository.find({ where: { roleId } });
        const originMenuRows = await this.roleMenuRepository.find({ where: { roleId } });
        const originMenuIds = originMenuRows.map((e) => e.menuId);
        const originDeptIds = originDeptRows.map((e) => e.departmentId);
        const insertMenusRowIds = difference(menus, originMenuIds);
        const deleteMenusRowIds = difference(originMenuIds, menus);
        const insertDeptRowIds = difference(depts, originDeptIds);
        const deleteDeptRowIds = difference(originDeptIds, depts);
        await this.entityManager.transaction(async (manager) => {
            if (insertMenusRowIds.length > 0) {
                await manager.insert(SysRoleMenu, insertMenusRowIds.map((e: any) => ({ roleId, menuId: e })));
            }
            if (deleteMenusRowIds.length > 0) {
                const realDeleteRowIds = filter(originMenuRows, (e: any) => includes(deleteMenusRowIds, e.menuId)).map((e: any) => e.id);
                await manager.delete(SysRoleMenu, realDeleteRowIds);
            }
            if (insertDeptRowIds.length > 0) {
                await manager.insert(SysRoleDepartment, insertDeptRowIds.map((e: any) => ({ roleId, departmentId: e })));
            }
            if (deleteDeptRowIds.length > 0) {
                const realDeleteRowIds = filter(originDeptRows, (e: any) => includes(deleteDeptRowIds, e.departmentId)).map((e: any) => e.id);
                await manager.delete(SysRoleDepartment, realDeleteRowIds);
            }
        });
        if ([insertMenusRowIds, deleteMenusRowIds].some((n) => n.length)) {
            this.adminWSService.noticeUserToUpdateMenusByRoleIds([roleId]);
        }
        return role;
    }

    async page(param: PageSearchRoleDto): Promise<[SysRole[], number]> {
        const { limit, page, name, label, remark } = param;
        return this.roleRepository.findAndCount({
            where: { id: Not(this.rootRoleId), name: Like(`%${name}%`), label: Like(`%${label}%`), remark: Like(`%${remark}%`) },
            order: { id: 'ASC' },
            take: limit,
            skip: (page - 1) * limit,
        });
    }

    async getRoleIdByUser(id: number): Promise<number[]> {
        const result = await this.userRoleRepository.find({ where: { userId: id } });
        if (!isEmpty(result)) return map(result, (v: any) => v.roleId);
        return [];
    }

    async countUserIdByRole(ids: number[]): Promise<number> {
        if (includes(ids, this.rootRoleId)) throw new Error('Not Support Delete Root');
        return this.userRoleRepository.count({ where: { roleId: In(ids) } });
    }
}
