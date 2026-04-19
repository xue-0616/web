import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export class BaseTime {
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}
