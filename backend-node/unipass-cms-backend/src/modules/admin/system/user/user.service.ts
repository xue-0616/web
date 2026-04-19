import { Injectable, Inject } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, Not, In } from 'typeorm';
import { UtilService } from '../../../../shared/services/util.service';
import { RedisService } from '../../../../shared/services/redis.service';
import { SysParamConfigService } from '../param-config/param-config.service';
import { AccountInfo, PageSearchUserInfo, UserDetailInfo } from './user.class';
import { CreateUserDto, PageSearchUserDto, UpdatePasswordDto, UpdateUserDto, UpdateUserInfoDto } from './user.dto';
import SysUser from '../../../../entities/default/admin/sys-user.entity';
import SysUserRole from '../../../../entities/default/admin/sys-user-role.entity';
import SysDepartment from '../../../../entities/default/admin/sys-department.entity';
import { ROOT_ROLE_ID } from '../../admin.constants';
import { camelCase, isEmpty } from 'lodash';
import { ApiException } from '../../../../common/exceptions/api.exception';
import { SYS_USER_INITPASSWORD } from '../../../../common/contants/param-config.contants';

@Injectable()
export class SysUserService {
    constructor(
        @InjectRepository(SysUser, 'default')
        private readonly userRepository: Repository<SysUser>,
        @InjectRepository(SysDepartment, 'default')
        private readonly departmentRepository: Repository<SysDepartment>,
        @InjectRepository(SysUserRole, 'default')
        private readonly userRoleRepository: Repository<SysUserRole>,
        private readonly redisService: RedisService,
        private readonly paramConfigService: SysParamConfigService,
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
        @Inject(ROOT_ROLE_ID)
        private readonly rootRoleId: number,
        private readonly util: UtilService,
    ) {}

    async findUserByUserName(username: string): Promise<SysUser | null> {
        return this.userRepository.findOne({ where: { username, status: 1 } });
    }

    async getAccountInfo(uid: number, ip: string): Promise<AccountInfo> {
        const user = await this.userRepository.findOne({ where: { id: uid } });
        if (!user || isEmpty(user)) throw new ApiException(10017);
        return { name: user.name, nickName: user.nickName, email: user.email, phone: user.phone, remark: user.remark, headImg: user.headImg, loginIp: ip };
    }

    async updatePersonInfo(uid: number, info: any): Promise<void> {
        await this.userRepository.update(uid, info);
    }

    async updatePassword(uid: number, dto: UpdatePasswordDto): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: uid } });
        if (!user || isEmpty(user)) throw new ApiException(10017);
        const comparePassword = this.util.md5(`${dto.originPassword}${user.psalt}`);
        if (user.password !== comparePassword) throw new ApiException(10011);
        const password = this.util.md5(`${dto.newPassword}${user.psalt}`);
        await this.userRepository.update({ id: uid }, { password });
        await this.upgradePasswordV(user.id);
    }

    async forceUpdatePassword(uid: number, password: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: uid } });
        if (!user || isEmpty(user)) throw new ApiException(10017);
        const newPassword = this.util.md5(`${password}${user.psalt}`);
        await this.userRepository.update({ id: uid }, { password: newPassword });
        await this.upgradePasswordV(user.id);
    }

    async add(param: CreateUserDto): Promise<void> {
        const exists = await this.userRepository.findOne({ where: { username: param.username } });
        if (!isEmpty(exists)) throw new ApiException(10001);
        await this.entityManager.transaction(async (manager) => {
            const salt = this.util.generateRandomValue(32);
            const initPassword = await this.paramConfigService.findValueByKey(SYS_USER_INITPASSWORD);
            const password = this.util.md5(`${initPassword ?? '123456'}${salt}`);
            const u = manager.create(SysUser, {
                departmentId: param.departmentId, username: param.username, password,
                name: param.name, nickName: param.nickName, email: param.email,
                phone: param.phone, remark: param.remark, status: param.status, psalt: salt,
            });
            const result = await manager.save(u);
            const insertRoles = param.roles.map((e: number) => ({ roleId: e, userId: result.id }));
            await manager.insert(SysUserRole, insertRoles);
        });
    }

    async update(param: UpdateUserDto): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            await manager.update(SysUser, param.id, {
                departmentId: param.departmentId, username: param.username,
                name: param.name, nickName: param.nickName, email: param.email,
                phone: param.phone, remark: param.remark, status: param.status,
            });
            await manager.delete(SysUserRole, { userId: param.id });
            const insertRoles = param.roles.map((e: number) => ({ roleId: e, userId: param.id }));
            await manager.insert(SysUserRole, insertRoles);
            if (param.status === 0) await this.forbidden(param.id);
        });
    }

    async info(id: number): Promise<UserDetailInfo> {
        const user = await this.userRepository.findOne({ where: { id } });
        if (!user || isEmpty(user)) throw new ApiException(10017);
        const departmentRow = await this.departmentRepository.findOne({ where: { id: user.departmentId } });
        if (!departmentRow || isEmpty(departmentRow)) throw new ApiException(10018);
        const roleRows = await this.userRoleRepository.find({ where: { userId: user.id } });
        const roles = roleRows.map((e) => e.roleId);
        delete (user as any).password;
        return { ...user, roles, departmentName: departmentRow.name } as unknown as UserDetailInfo;
    }

    async infoList(ids: number[]): Promise<SysUser[]> {
        return this.userRepository.findBy({ id: In(ids) });
    }

    async delete(userIds: number[]): Promise<void> {
        const rootUserId = await this.findRootUserId();
        if (userIds.includes(rootUserId)) throw new Error('can not delete root user!');
        await this.userRepository.delete(userIds);
        await this.userRoleRepository.delete({ userId: In(userIds) });
    }

    async count(uid: number, deptIds: number[]): Promise<number> {
        const queryAll = isEmpty(deptIds);
        const rootUserId = await this.findRootUserId();
        if (queryAll) {
            return this.userRepository.count({ where: { id: Not(In([rootUserId, uid])) } });
        }
        return this.userRepository.count({ where: { id: Not(In([rootUserId, uid])), departmentId: In(deptIds) } });
    }

    async findRootUserId(): Promise<number> {
        const result = await this.userRoleRepository.findOne({ where: { id: this.rootRoleId } as any });
        return (result as any).userId;
    }

    async page(uid: number, params: PageSearchUserDto): Promise<[PageSearchUserInfo[], number]> {
        const { departmentIds, limit, page, name, username, phone, remark } = params;
        const queryAll = isEmpty(departmentIds);
        const rootUserId = await this.findRootUserId();
        const qb = this.userRepository.createQueryBuilder('user')
            .innerJoinAndSelect('sys_department', 'dept', 'dept.id = user.departmentId')
            .innerJoinAndSelect('sys_user_role', 'user_role', 'user_role.user_id = user.id')
            .innerJoinAndSelect('sys_role', 'role', 'role.id = user_role.role_id')
            .select(['user.id,GROUP_CONCAT(role.name) as roleNames', 'dept.name', 'user.*'])
            .where('user.id NOT IN (:...ids)', { ids: [rootUserId, uid] })
            .andWhere(queryAll ? '1 = 1' : 'user.departmentId IN (:...deptIds)', { deptIds: departmentIds })
            .andWhere('user.name LIKE :name', { name: `%${name}%` })
            .andWhere('user.username LIKE :username', { username: `%${username}%` })
            .andWhere('user.remark LIKE :remark', { remark: `%${remark}%` })
            .andWhere('user.phone LIKE :phone', { phone: `%${phone}%` })
            .orderBy('user.updated_at', 'DESC')
            .groupBy('user.id')
            .offset((page - 1) * limit)
            .limit(limit);
        const [_, total] = await qb.getManyAndCount();
        const list = await qb.getRawMany();
        const dealResult = list.map((n: any) => {
            const convertData = Object.entries(n).map(([key, value]) => [camelCase(key), value]);
            return { ...Object.fromEntries(convertData), departmentName: n.dept_name, roleNames: n.roleNames?.split(',') || [] };
        });
        return [dealResult, total];
    }

    async forbidden(uid: number): Promise<void> {
        await this.redisService.getRedis().del(`admin:passwordVersion:${uid}`);
        await this.redisService.getRedis().del(`admin:token:${uid}`);
        await this.redisService.getRedis().del(`admin:perms:${uid}`);
    }

    async multiForbidden(uids: number[]): Promise<void> {
        if (uids) {
            const pvs: string[] = [], ts: string[] = [], ps: string[] = [];
            uids.forEach((e) => { pvs.push(`admin:passwordVersion:${e}`); ts.push(`admin:token:${e}`); ps.push(`admin:perms:${e}`); });
            await this.redisService.getRedis().del(pvs);
            await this.redisService.getRedis().del(ts);
            await this.redisService.getRedis().del(ps);
        }
    }

    async upgradePasswordV(id: number): Promise<void> {
        const v = await this.redisService.getRedis().get(`admin:passwordVersion:${id}`);
        if (!isEmpty(v)) {
            await this.redisService.getRedis().set(`admin:passwordVersion:${id}`, parseInt(v as string) + 1);
        }
    }
}
