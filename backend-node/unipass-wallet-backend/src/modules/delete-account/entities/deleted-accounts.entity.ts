import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from '../../action-point/entities';
import { bufferTransformer } from '../../../shared/utils';

@Entity({ name: 'deleted_accounts' })
export class DeletedAccountEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column({
        transformer: bufferTransformer,
    })
    address: any;
    @Column()
    source: any;
    @Column()
    status: any;
}
