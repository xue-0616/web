import { BaseEntity } from '../base.entity';

export default class StatisticsEvent extends BaseEntity {
  id!: number;
  blockNumber!: string;
  transactionHash!: string;
  address!: string;
  topics!: string;
  email!: string;
  source!: string;
}
