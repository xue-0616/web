import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'nft_collection' })
@Index(['address'], { unique: true })
export class NFTCollectionEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    address: any;
    @Column()
    imageUrl: any;
    @Column()
    slug: any;
    @Column()
    name: any;
    @Column()
    symbol: any;
    @CreateDateColumn()
    createdAt: any;
}
