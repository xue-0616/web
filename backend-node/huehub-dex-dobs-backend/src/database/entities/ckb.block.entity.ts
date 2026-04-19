import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

@Entity({ name: 'ckb_block' })
export class CkbBlockEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    curBlockNumber!: number;
}
