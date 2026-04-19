import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

export enum KeyUsedStatus {
    OldKey = 0,
    NewKey = 1,
}

@Entity({ name: 'user_key_encrypts' })
export class UserKeyEncryptsEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    userId: number;
    @Column()
    address: string;
    @Column()
    status: KeyUsedStatus;
    @Column()
    keyEncrypted: string;
}
