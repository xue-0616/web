import { BaseEntity } from '../base.entity';

export default class StatisticsSign extends BaseEntity {
  id!: number;
  offset!: number;
  provider!: string;
  email!: string;
  source!: string;
}
