import SysMenu from '../../../../entities/default/admin/sys-menu.entity';

export class MenuItemAndParentInfoResult {
    menu!: SysMenu | null;
    parentMenu?: SysMenu;
}
