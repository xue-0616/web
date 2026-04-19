import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from './custom-auth.accounts.entity';
import { bufferTransformer } from '../../../shared/utils';

export enum AlgType {
    sha256 = 0,
    keccak256 = 1,
    personalHash = 2,
    keysetHash = 3,
}

@Entity({ name: 'ori_hash' })
export class OriHashEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column({
        type: 'json',
    })
    raw: any;
    @Column({
        transformer: bufferTransformer,
    })
    hash: any;
    @Column()
    alg: any;
}
