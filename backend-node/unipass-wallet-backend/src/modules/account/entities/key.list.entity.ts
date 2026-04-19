import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bufferTransformer } from '../../../shared/utils';

export enum KeyStatus {
    generateKey = 0,
    pending = 1,
    recoveryPending = 2,
    committed = 3,
    failed = 4,
}

@Entity({ name: 'key_list' })
@Index(['accountId', 'address'], { unique: true })
export class KeyListEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    @Index()
    accountId: any;
    @Column({
        transformer: bufferTransformer,
    })
    web3AuthAddress: any;
    @Column({
        transformer: bufferTransformer,
    })
    address: any;
    @Column()
    uuid: any;
    @Column()
    status: any;
    @Column()
    keystore: any;
    @Column()
    keyType: any;
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}
