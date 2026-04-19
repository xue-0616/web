import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { RedisService } from '../../../../shared/services/redis.service';
import { AdminWSService } from '../../../../modules/ws/admin-ws.service';
import { SysRoleService } from '../role/role.service';
import { MenuItemAndParentInfoResult } from './menu.class';
import { CreateMenuDto } from './menu.dto';
import SysMenu from '../../../../entities/default/admin/sys-menu.entity';
import { ROOT_ROLE_ID } from '../../admin.constants';
import { concat, includes, isEmpty, uniq } from 'lodash';
import { ApiException } from '../../../../common/exceptions/api.exception';

@Injectable()
export class SysMenuService {
    constructor(
        @InjectRepository(SysMenu, 'default')
        private readonly menuRepository: Repository<SysMenu>,
        private readonly redisService: RedisService,
        @Inject(ROOT_ROLE_ID)
        private readonly rootRoleId: number,
        private readonly roleService: SysRoleService,
        private readonly adminWSService: AdminWSService,
    ) {}

    async list(): Promise<SysMenu[]> {
        return this.menuRepository.find();
    }

    async save(menu: any): Promise<void> {
        await this.menuRepository.save(menu);
        this.adminWSService.noticeUserToUpdateMenusByRoleIds([this.rootRoleId]);
    }

    async getMenus(uid: number): Promise<SysMenu[]> {
        const roleIds = await this.roleService.getRoleIdByUser(uid);
        if (includes(roleIds, this.rootRoleId)) {
            return this.menuRepository.find();
        }
        return this.menuRepository.createQueryBuilder('menu')
            .innerJoinAndSelect('sys_role_menu', 'role_menu', 'menu.id = role_menu.menu_id')
            .andWhere('role_menu.role_id IN (:...roleIds)', { roleIds })
            .orderBy('menu.order_num', 'DESC')
            .getMany();
    }

    async check(dto: CreateMenuDto): Promise<void> {
        if (Number(dto.type) === 2 && dto.parentId === -1) throw new ApiException(10005);
        if (Number(dto.type) === 1 && dto.parentId !== -1) {
            const parent = await this.getMenuItemInfo(dto.parentId);
            if (isEmpty(parent)) throw new ApiException(10014);
            if (parent && Number(parent.type) === 1) throw new ApiException(10006);
        }
        if (!Object.is(Number(dto.type), 2)) {
            const menus = await this.menuRepository.find({ where: { parentId: Object.is(dto.parentId, -1) ? null : dto.parentId } as any });
            const router = dto.router.split('/').filter(Boolean).join('/');
            const pathReg = new RegExp(`^/?${router}/?$`);
            const isExist = menus.some((n) => pathReg.test(n.router) && n.id !== (dto as any).menuId);
            if (isExist) throw new ApiException(10004);
        }
    }

    async findChildMenus(mid: number): Promise<any[]> {
        const allMenus: any[] = [];
        const menus = await this.menuRepository.find({ where: { parentId: mid } });
        for (let i = 0; i < menus.length; i++) {
            if (Number(menus[i].type) !== 2) {
                const c = await this.findChildMenus(menus[i].id);
                allMenus.push(c);
            }
            allMenus.push(menus[i].id);
        }
        return allMenus;
    }

    async getMenuItemInfo(mid: number): Promise<SysMenu | null> {
        return this.menuRepository.findOne({ where: { id: mid } }) as any;
    }

    async getMenuItemAndParentInfo(mid: number): Promise<MenuItemAndParentInfoResult> {
        const menu = await this.menuRepository.findOne({ where: { id: mid } });
        let parentMenu: SysMenu | undefined;
        if (menu && menu.parentId) {
            parentMenu = await this.menuRepository.findOne({ where: { id: menu.parentId } }) as any;
        }
        return { menu, parentMenu };
    }

    async findRouterExist(router: string): Promise<boolean> {
        const menus = await this.menuRepository.findOne({ where: { router } });
        return !isEmpty(menus);
    }

    async getPerms(uid: number): Promise<string[]> {
        const roleIds = await this.roleService.getRoleIdByUser(uid);
        let perms: string[] = [];
        let result: SysMenu[] | null = null;
        if (includes(roleIds, this.rootRoleId)) {
            result = await this.menuRepository.find({ where: { perms: Not(IsNull()), type: '2' as any } });
        } else {
            result = await this.menuRepository.createQueryBuilder('menu')
                .innerJoinAndSelect('sys_role_menu', 'role_menu', 'menu.id = role_menu.menu_id')
                .andWhere('role_menu.role_id IN (:...roleIds)', { roleIds })
                .andWhere('menu.type = 2')
                .andWhere('menu.perms IS NOT NULL')
                .getMany();
        }
        if (!isEmpty(result)) {
            result.forEach((e) => { perms = concat(perms, e.perms.split(',')); });
            perms = uniq(perms);
        }
        return perms;
    }

    async deleteMenuItem(mids: number[]): Promise<void> {
        await this.menuRepository.delete(mids);
        this.adminWSService.noticeUserToUpdateMenusByMenuIds(mids);
    }

    async refreshPerms(uid: number): Promise<void> {
        const perms = await this.getPerms(uid);
        const online = await this.redisService.getRedis().get(`admin:token:${uid}`);
        if (online) {
            await this.redisService.getRedis().set(`admin:perms:${uid}`, JSON.stringify(perms));
        }
    }

    async refreshOnlineUserPerms(): Promise<void> {
        const onlineUserIds = await this.redisService.getRedis().keys('admin:token:*');
        if (onlineUserIds && onlineUserIds.length > 0) {
            for (let i = 0; i < onlineUserIds.length; i++) {
                const uid = onlineUserIds[i].split('admin:token:')[1];
                const perms = await this.getPerms(parseInt(uid));
                await this.redisService.getRedis().set(`admin:perms:${uid}`, JSON.stringify(perms));
            }
        }
    }
}
