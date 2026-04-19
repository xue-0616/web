import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'nft_token' })
@Index(['address', 'tokenId'], { unique: true })
export class NFTTokenEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    address: any;
    @Column()
    tokenId: any;
    @Column()
    imageUrl: any;
    @Column()
    imageOriginalUrl: any;
    @Column()
    name: any;
    @CreateDateColumn()
    createdAt: any;
}
