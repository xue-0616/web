import { PageOptionsDto } from '../../../../common/dto/page.dto';

export class DeleteRoleDto {
    roleIds!: number[];
}

export class CreateRoleDto {
    name!: string;
    label!: string;
    remark?: string;
    menus?: number[];
    depts?: number[];
}

export class UpdateRoleDto extends CreateRoleDto {
    roleId!: number;
}

export class InfoRoleDto {
    roleId!: number;
}

export class PageSearchRoleDto extends PageOptionsDto {
    name = '';
    label = '';
    remark = '';
}
