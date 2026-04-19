import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bufferTransformer } from '../common/utils/buffer.transformer';

export enum AlgType {
    sha256 = 0,
    keccak256 = 1,
    personalHash = 2,
    keysetHash = 3,
}

@Entity({ name: 'ori_hash' })
export class OriHashEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    raw!: string;
    @Column({
        transformer: bufferTransformer,
    })
    hash!: string;
    @Column()
    alg!: number;
    @CreateDateColumn()
    createdAt!: Date;
    @UpdateDateColumn()
    updatedAt!: Date;
}
