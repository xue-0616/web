import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class HolderOutput {
    @ApiPropertyOptional({
        enum: String,
        description: 'holder address',
    })
    @IsOptional()
    address!: string;
    @ApiPropertyOptional({
        enum: String,
        description: 'holder amount',
    })
    @IsOptional()
    tokenAmount!: string;
    @ApiProperty({
        type: String,
        description: 'holder ratio',
    })
    ratio!: string;
    @ApiProperty({
        type: String,
        description: 'rgb++ token name',
    })
    name!: string;
    @ApiProperty({
        type: String,
        description: 'rgb++ token symbol',
    })
    symbol!: string;
    @ApiProperty({
        type: Number,
        description: 'sell rgb++ token decimal',
    })
    tokenDecimal!: number;
}

export class HolderListOutputDto {
    @ApiProperty({
        type: [HolderOutput],
        description: 'token holder list',
    })
    list!: HolderOutput[];
}
