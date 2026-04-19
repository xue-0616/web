import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from '../../action-point/entities';
import { bufferTransformer } from '../../../shared/utils';

@Entity({ name: 'custom_auth_accounts' })
@Index(['appId', 'sub'], { unique: true })
@Index(['address'])
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
    @Column({
        transformer: bufferTransformer,
    })
    pendingKeysetHash: any;
    @Column()
    pendingCreatedAt: any;
    @Column()
    status: any;
}
