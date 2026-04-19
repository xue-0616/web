import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from '../../action-point/entities';

@Entity({ name: 'custom_auth_app_infos' })
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
    @Column({
        type: 'json',
    })
    appInfo: any;
    @Column({
        type: 'json',
    })
    jwtPubkey: any;
}
