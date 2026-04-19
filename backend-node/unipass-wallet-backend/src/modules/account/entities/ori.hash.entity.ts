import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bufferTransformer } from '../../../shared/utils';

export enum AlgType {
    sha256 = 0,
    keccak256 = 1,
    personalHash = 2,
    keysetHash = 3,
}

@Entity({ name: 'ori_hash' })
export class OriHashEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    raw: any;
    @Column({
        transformer: bufferTransformer,
    })
    hash: any;
    @Column()
    alg: any;
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}
