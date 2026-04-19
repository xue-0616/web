import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';
import { bufferTransformer } from '../../common/utils/buffer.transformer';

@Entity({ name: 'dobs' })
export class DobsEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column({
        transformer: bufferTransformer,
    })
    clusterTypeArgs!: string;
    @Column()
    blockNumber!: number;
    @Column({
        transformer: bufferTransformer,
    })
    txHash!: string;
    @Column()
    cellIndex!: number;
    @Column({
        transformer: bufferTransformer,
    })
    owner!: string;
    @Column({
        transformer: bufferTransformer,
    })
    typeScriptHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    typeCodeHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    typeArgs!: string;
    @Column({
        transformer: bufferTransformer,
    })
    lockScriptHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    lockCodeHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    lockArgs!: string;
    @Column({
        transformer: bufferTransformer,
    })
    data!: string;
    @Column()
    capacity!: string;
    @Column()
    sporeTokenId!: string;
    @Column()
    sporeContentType!: string;
    @Column()
    sporePrevBgcolor!: string;
    @Column()
    sporeIconUrl!: string | null;
    @Column()
    btcAddress!: string;
    @Column({
        transformer: bufferTransformer,
    })
    btcTxHash!: string;
    @Column()
    btcIndex!: number;
    @Column()
    btcValue!: number;
}
