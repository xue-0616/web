import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bufferTransformer } from '../../../shared/utils';

export enum AccountStatus {
    generateKey = 0,
    pending = 1,
    committed = 2,
    failed = 3,
    migrated = 4,
}

export enum ProviderType {
    google = 0,
    auth0_email = 1,
    auth0_apple = 2,
    auth0_unipass = 3,
    aws_kms = 4,
}

@Entity({ name: 'accounts' })
@Index(['email', 'provider'], { unique: true })
export class AccountsEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column({
        transformer: bufferTransformer,
    })
    address: any;
    @Column()
    email: any;
    @Column()
    source: any;
    @Column()
    pepper: any;
    @Column({
        transformer: bufferTransformer,
    })
    initKeysetHash: any;
    @Column({
        transformer: bufferTransformer,
    })
    keysetHash: any;
    @Column({
        transformer: bufferTransformer,
    })
    pendingKeysetHash: any;
    @Column()
    pendingCreatedAt: any;
    @Column()
    emailInLowerCase: any;
    @Column()
    status: any;
    @Column()
    sub: any;
    @Column()
    provider: any;
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}
