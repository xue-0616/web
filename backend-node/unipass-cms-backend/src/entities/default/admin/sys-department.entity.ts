import { BaseEntity } from '../base.entity';

export default class SysDepartment extends BaseEntity {
  id!: number;
  parentId!: number | null;
  name!: string;
  orderNum!: number;
}
