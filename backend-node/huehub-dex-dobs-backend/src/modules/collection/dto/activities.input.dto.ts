import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Min, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { TypeHashValidator } from '../../../common/utils/typehash.validator';

export enum ActivityType {
    All = 0,
    Sale = 1,
    List = 2,
    Transfer = 3,
    Unlist = 4,
}

export class ActivitiesInputDto {
    constructor() {
        this.page = 0;
        this.limit = 10;
    }
    @ApiProperty({
        enum: ActivityType,
        description: 'query order type enum,0:All,1:Sale,2:List,3:Transfer 4: Unlist',
    })
    @IsEnum(ActivityType)
    @Transform(({ value }) => parseInt(value, 10))
    activityType!: ActivityType;
    @ApiProperty({
        type: String,
        description: 'collection type hash',
    })
    @IsString()
    @Validate(TypeHashValidator)
    clusterTypeHash!: string;
    @ApiPropertyOptional({
        type: Number,
        description: 'page number',
        default: 0,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @Min(0)
    page: number;
    @ApiPropertyOptional({
        type: Number,
        required: true,
        default: 10,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @Min(10)
    limit: number;
}
