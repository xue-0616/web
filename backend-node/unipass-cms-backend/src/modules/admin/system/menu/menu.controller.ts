import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiSecurity, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { IAdminUser } from '../../admin.interface';
import { AdminUser } from '../../core/decorators/admin-user.decorator';
import { MenuItemAndParentInfoResult } from './menu.class';
import { CreateMenuDto, DeleteMenuDto, InfoMenuDto, UpdateMenuDto } from './menu.dto';
import { SysMenuService } from './menu.service';
import SysMenu from '../../../../entities/default/admin/sys-menu.entity';
import { flattenDeep } from 'lodash';
import { FORBIDDEN_OP_MENU_ID_INDEX, ADMIN_PREFIX } from '../../admin.constants';
import { ApiException } from '../../../../common/exceptions/api.exception';

@ApiSecurity(ADMIN_PREFIX)
@ApiTags('菜单权限模块')
@Controller('menu')
export class SysMenuController {
    constructor(private readonly menuService: SysMenuService) {}

    @ApiOperation({ summary: '获取对应权限的菜单列表' })
    @ApiOkResponse({ type: [SysMenu] })
    @Get('list')
    async list(@AdminUser() user: IAdminUser): Promise<SysMenu[]> {
        return this.menuService.getMenus(user.uid);
    }

    @ApiOperation({ summary: '新增菜单或权限' })
    @Post('add')
    async add(@Body() dto: CreateMenuDto): Promise<void> {
        await this.menuService.check(dto);
        if (dto.parentId === -1) dto.parentId = null as any;
        await this.menuService.save(dto);
        if (dto.type === 2) await this.menuService.refreshOnlineUserPerms();
    }

    @ApiOperation({ summary: '更新菜单或权限' })
    @Post('update')
    async update(@Body() dto: UpdateMenuDto): Promise<void> {
        if (dto.menuId <= FORBIDDEN_OP_MENU_ID_INDEX) throw new ApiException(10016);
        await this.menuService.check(dto);
        if (dto.parentId === -1) dto.parentId = null as any;
        const insertData = { ...dto, id: dto.menuId };
        await this.menuService.save(insertData);
        if (dto.type === 2) await this.menuService.refreshOnlineUserPerms();
    }

    @ApiOperation({ summary: '删除菜单或权限' })
    @Post('delete')
    async delete(@Body() dto: DeleteMenuDto): Promise<void> {
        if (dto.menuId <= FORBIDDEN_OP_MENU_ID_INDEX) throw new ApiException(10016);
        const childMenus = await this.menuService.findChildMenus(dto.menuId);
        await this.menuService.deleteMenuItem(flattenDeep([dto.menuId, childMenus]));
        await this.menuService.refreshOnlineUserPerms();
    }

    @ApiOperation({ summary: '菜单或权限信息' })
    @ApiOkResponse({ type: MenuItemAndParentInfoResult })
    @Get('info')
    async info(@Query() dto: InfoMenuDto): Promise<MenuItemAndParentInfoResult> {
        return this.menuService.getMenuItemAndParentInfo(dto.menuId);
    }
}
