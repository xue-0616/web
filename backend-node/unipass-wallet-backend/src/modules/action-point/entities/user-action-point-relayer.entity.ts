import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from './base.time';
import { bufferTransformer } from '../../../shared/utils';

export enum IApRelayerStatus {
    CLOSE = 0,
    OPEN = 1,
}

@Entity({ name: 'action_point_relayer' })
export class UserActionPointRelayerEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column({
        transformer: bufferTransformer,
    })
    relayerAuthAddr: any;
    @Column()
    relayerUrl: any;
    @Column()
    status: any;
}
