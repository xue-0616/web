import { ApiProperty } from '@nestjs/swagger';
import { IsString, Validate } from 'class-validator';
import { TypeHashtValidator } from '../../../common/utils/typehash.validator';

export class SnapshotInputDto {
    @ApiProperty({
        enum: String,
        description: 'token xudt type hash',
    })
    @IsString()
    @Validate(TypeHashtValidator)
    xudtTypeHash!: string;
}
