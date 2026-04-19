import { PageOptionsDto } from '../../../../common/dto/page.dto';

export class UpdateUserInfoDto {
    nickName!: string;
    email!: string;
    phone!: string;
    remark?: string;
}

export class UpdatePasswordDto {
    originPassword!: string;
    newPassword!: string;
}

export class CreateUserDto {
    departmentId!: number;
    name!: string;
    username!: string;
    roles!: number[];
    nickName?: string;
    email?: string;
    phone?: string;
    remark?: string;
    status?: number;
}

export class UpdateUserDto extends CreateUserDto {
    id!: number;
}

export class InfoUserDto {
    userId!: number;
}

export class DeleteUserDto {
    userIds!: number[];
}

export class PageSearchUserDto extends PageOptionsDto {
    departmentIds?: number[];
    name = '';
    username = '';
    phone = '';
    remark = '';
}

export class PasswordUserDto {
    userId!: number;
    password!: string;
}
