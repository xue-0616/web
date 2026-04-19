import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

@Entity({ name: 'tokens_icon' })
export class TokenIconEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    imageData!: string;
    @Column()
    tokenId!: number;
}
