export class CreateDeptDto {
    name!: string;
    parentId?: number;
    orderNum?: number;
}

export class UpdateDeptDto extends CreateDeptDto {
    id!: number;
}

export class DeleteDeptDto {
    departmentId!: number;
}

export class InfoDeptDto {
    departmentId!: number;
}

export class TransferDeptDto {
    userIds!: number[];
    departmentId!: number;
}

export class MoveDept {
    id!: number;
    parentId!: number;
}

export class MoveDeptDto {
    depts!: MoveDept[];
}
