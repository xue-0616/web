import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'chain_sync' })
export class ChainSyncEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    @Index()
    accountId: any;
    @Column()
    @Index()
    metaNonce: any;
    @Column()
    transactionJson: any;
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}
