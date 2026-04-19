import { BaseEntity } from '../base.entity';

export default class SysTask extends BaseEntity {
  id!: number;
  name!: string;
  service!: string;
  type!: string;
  status!: number;
  startTime!: string;
  endTime!: string;
  limit!: number;
  cron!: string;
  every!: number;
  data!: string;
  jobOpts!: string;
  remark!: string;
}
