import SysUser from '../../../../entities/default/admin/sys-user.entity';

export class AccountInfo {
    name!: string;
    nickName!: string;
    email!: string;
    phone!: string;
    remark?: string;
    headImg?: string;
    loginIp?: string;
}

export class PageSearchUserInfo {
    createdAt?: Date;
    departmentId?: number;
    email?: string;
    headImg?: string;
    id!: number;
    name!: string;
    nickName?: string;
    phone?: string;
    remark?: string;
    status?: number;
    updatedAt?: Date;
    username!: string;
    departmentName?: string;
    roleNames?: string[];
}

export class UserDetailInfo extends SysUser {
    roles!: number[];
    departmentName!: string;
}
