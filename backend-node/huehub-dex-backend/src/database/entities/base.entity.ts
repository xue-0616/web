import { CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export class MyBaseEntity {
    @CreateDateColumn({ name: 'created_at' })
    @ApiProperty()
    createdAt!: Date;
    @UpdateDateColumn({ name: 'updated_at' })
    @ApiProperty()
    updatedAt!: Date;
}
