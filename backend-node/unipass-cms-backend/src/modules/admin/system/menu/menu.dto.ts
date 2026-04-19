export class CreateMenuDto {
    type!: number;
    parentId!: number;
    name!: string;
    orderNum?: number;
    router!: string;
    isShow = true;
    keepalive = true;
    isExt = true;
    openMode = 1;
    icon?: string;
    perms?: string;
    viewPath?: string;
}

export class UpdateMenuDto extends CreateMenuDto {
    menuId!: number;
}

export class DeleteMenuDto {
    menuId!: number;
}

export class InfoMenuDto {
    menuId!: number;
}
