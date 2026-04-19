import SysMenu from '../../../entities/default/admin/sys-menu.entity';

export class ImageCaptcha {
    img!: string;
    id!: string;
}

export class LoginToken {
    token!: string;
}

export class PermMenuInfo {
    menus!: SysMenu[];
    perms!: string[];
}
