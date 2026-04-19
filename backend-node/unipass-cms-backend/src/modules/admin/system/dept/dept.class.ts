import SysDepartment from '../../../../entities/default/admin/sys-department.entity';

export class DeptDetailInfo {
    department!: SysDepartment;
    parentDepartment!: SysDepartment | null;
}
