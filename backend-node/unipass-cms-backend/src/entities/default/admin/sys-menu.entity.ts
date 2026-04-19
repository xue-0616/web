import { BaseEntity } from '../base.entity';

export default class SysMenu extends BaseEntity {
  id!: number;
  parentId!: number | null;
  name!: string;
  router!: string;
  perms!: string;
  type!: string;
  icon!: string;
  orderNum!: number;
  viewPath!: string;
  keepalive!: boolean;
  isShow!: boolean;
  isExt!: boolean;
  openMode!: string;
}
