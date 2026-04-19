import { Injectable, Inject } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, In } from 'typeorm';
import { SysRoleService } from '../role/role.service';
import { DeptDetailInfo } from './dept.class';
import { MoveDept, UpdateDeptDto } from './dept.dto';
import SysUser from '../../../../entities/default/admin/sys-user.entity';
import SysDepartment from '../../../../entities/default/admin/sys-department.entity';
import SysRoleDepartment from '../../../../entities/default/admin/sys-role-department.entity';
import { ROOT_ROLE_ID } from '../../admin.constants';
import { includes, isEmpty } from 'lodash';
import { ApiException } from '../../../../common/exceptions/api.exception';

@Injectable()
export class SysDeptService {
    constructor(
        @InjectRepository(SysUser, 'default')
        private readonly userRepository: Repository<SysUser>,
        @InjectRepository(SysDepartment, 'default')
        private readonly deptRepository: Repository<SysDepartment>,
        @InjectRepository(SysRoleDepartment, 'default')
        private readonly roleDeptRepository: Repository<SysRoleDepartment>,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
        @Inject(ROOT_ROLE_ID)
        private readonly rootRoleId: number,
        private readonly roleService: SysRoleService,
    ) {}

    async list(): Promise<SysDepartment[]> {
        return this.deptRepository.find({ order: { orderNum: 'DESC' } });
    }

    async info(id: number): Promise<DeptDetailInfo> {
        const department = await this.deptRepository.findOne({ where: { id } });
        if (!department || isEmpty(department)) throw new ApiException(10019);
        let parentDepartment = null;
        if (department.parentId) {
            parentDepartment = await this.deptRepository.findOne({ where: { id: department.parentId } });
        }
        return { department, parentDepartment };
    }

    async update(param: UpdateDeptDto): Promise<void> {
        await this.deptRepository.update(param.id, {
            parentId: param.parentId === -1 ? undefined : param.parentId,
            name: param.name,
            orderNum: param.orderNum,
        });
    }

    async transfer(userIds: number[], deptId: number): Promise<void> {
        await this.userRepository.update({ id: In(userIds) }, { departmentId: deptId });
    }

    async add(deptName: string, parentDeptId: number): Promise<void> {
        await this.deptRepository.insert({ name: deptName, parentId: parentDeptId === -1 ? null : parentDeptId });
    }

    async move(depts: MoveDept[]): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            for (const dept of depts) {
                await manager.update(SysDepartment, { id: dept.id }, { parentId: dept.parentId });
            }
        });
    }

    async delete(departmentId: number): Promise<void> {
        await this.deptRepository.delete(departmentId);
    }

    async countUserByDeptId(id: number): Promise<number> {
        return this.userRepository.count({ where: { departmentId: id } });
    }

    async countRoleByDeptId(id: number): Promise<number> {
        return this.roleDeptRepository.count({ where: { departmentId: id } });
    }

    async countChildDept(id: number): Promise<number> {
        return this.deptRepository.count({ where: { parentId: id } });
    }

    async getDepts(uid: number): Promise<SysDepartment[]> {
        const roleIds = await this.roleService.getRoleIdByUser(uid);
        if (includes(roleIds, this.rootRoleId)) {
            return this.deptRepository.find();
        }
        return this.deptRepository.createQueryBuilder('dept')
            .innerJoinAndSelect('sys_role_department', 'role_dept', 'dept.id = role_dept.department_id')
            .andWhere('role_dept.role_id IN (:...roleIds)', { roleIds })
            .orderBy('dept.order_num', 'ASC')
            .getMany();
    }
}
