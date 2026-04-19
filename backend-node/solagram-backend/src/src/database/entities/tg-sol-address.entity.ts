import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

@Entity({ name: 'tg_sol_address' })
export class TgSolAddressEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    userId: number;
    @Column()
    address: string;
}
