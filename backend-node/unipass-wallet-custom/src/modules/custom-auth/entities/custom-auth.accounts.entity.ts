import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bufferTransformer } from '../../../shared/utils';

export enum AccountStatus {
    generateKey = 0,
    pending = 1,
    committed = 2,
    failed = 3,
}

export class BaseTime {
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}

@Entity({ name: 'custom_auth_accounts' })
@Index(['appId', 'sub'], { unique: true })
@Index(['address'])
@Index(['chainId'])
export class CustomAuthAccountsEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column({
        transformer: bufferTransformer,
    })
    address: any;
    @Column()
    sub: any;
    @Column()
    email: any;
    @Column()
    appId: any;
    @Column({
        type: 'json',
    })
    userInfo: any;
    @Column({
        transformer: bufferTransformer,
    })
    initKeysetHash: any;
    @Column({
        transformer: bufferTransformer,
    })
    keysetHash: any;
    @Column()
    status: any;
    @Column({
        type: 'bigint',
    })
    chainId: any;
}
