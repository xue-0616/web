import { BaseEntity } from '../base.entity';

export default class SysRole extends BaseEntity {
  id!: number;
  userId!: number;
  name!: string;
  label!: string;
  remark!: string;
}
