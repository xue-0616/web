import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bufferTransformer } from '../common/utils/buffer.transformer';

export enum ProviderType {
    google = 0,
    auth0_email = 1,
    auth0_apple = 2,
}

@Entity({ name: 'accounts' })
@Index(['email', 'provider'], { unique: true })
export class AccountsEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column({
        transformer: bufferTransformer,
    })
    address!: string;
    @Column()
    email!: string;
    @Column()
    source!: string;
    @Column()
    pepper!: string;
    @Column({
        transformer: bufferTransformer,
    })
    initKeysetHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    keysetHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    pendingKeysetHash!: string;
    @Column()
    pendingCreatedAt!: Date;
    @Column()
    emailInLowerCase!: string;
    @Column()
    status!: number;
    @Column()
    sub!: string;
    @Column()
    provider!: number;
    @CreateDateColumn()
    createdAt!: Date;
    @UpdateDateColumn()
    updatedAt!: Date;
}
