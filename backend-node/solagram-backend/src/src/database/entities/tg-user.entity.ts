import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

@Entity({ name: 'tg_users' })
export class TgUserEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    userId!: number;
    @Column()
    firstName!: string;
    @Column()
    lastName!: string;
    @Column()
    username!: string;
    @Column()
    isBot!: boolean;
}
