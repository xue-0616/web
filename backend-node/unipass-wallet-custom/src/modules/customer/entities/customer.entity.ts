import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from '../../custom-auth/entities';

export enum CustomerType {
    UnderReview = 0,
    InUse = 1,
    Frozen = 2,
}

export enum CustomerProvider {
    Google = 0,
}

@Entity({ name: 'customer' })
export class CustomerEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    gasTankBalance: any;
    @Column()
    sub: any;
    @Column()
    provider: any;
    @Column()
    status: any;
    @Column({
        type: 'json',
    })
    customerInfo: any;
}
