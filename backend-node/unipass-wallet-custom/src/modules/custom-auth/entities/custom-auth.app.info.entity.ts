import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from './custom-auth.accounts.entity';

@Entity({ name: 'custom_auth_app_infos' })
@Index(['appName'])
export class CustomAuthAppInfoEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    appId: any;
    @Column()
    jwtVerifierIdKey: any;
    @Column()
    appName: any;
    @Column()
    verifierName: any;
    @Column()
    web3authClientId: any;
    @Column()
    web3authEnv: any;
    @Column()
    customerId: any;
    @Column()
    unipassCallbackAuth: any;
    @Column()
    customPolicyPublicKey: any;
    @Column()
    callbackUrl: any;
    @Column()
    enableCustomPolicy: any;
    @Column({
        type: 'json',
    })
    appInfo: any;
    @Column({
        type: 'json',
    })
    jwtPubkey: any;
}
