import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

@Entity({ name: 'blink_short_code' })
export class BlinkShortCodeEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    shortCode!: string;
    @Column()
    blink!: string;
    @Column()
    domain!: string;
}
