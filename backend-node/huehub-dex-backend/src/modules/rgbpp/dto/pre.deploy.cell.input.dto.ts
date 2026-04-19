import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class PreDeployInputDto {
    @ApiProperty({
        type: String,
        description: 'depoly token name',
    })
    @IsString()
    name!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'icon base 64',
    })
    @IsOptional()
    @IsString()
    iconData!: string;
    @ApiProperty({
        type: String,
        description: 'depoly token symbol',
    })
    @IsString()
    symbol!: string;
    @ApiProperty({
        type: Number,
        description: 'depoly token decimal',
    })
    @IsNumber()
    decimal!: number;
    @ApiProperty({
        type: String,
        description: 'depoly token total supply',
    })
    @IsString()
    supply!: string;
    @ApiProperty({
        type: Number,
        description: 'depoly token limit per mint',
    })
    @IsNumber()
    limitPerMint!: number;
    @ApiProperty({
        type: Number,
        description: 'mint start block',
    })
    @IsNumber()
    startBlock!: number;
    @ApiPropertyOptional({
        type: Number,
        description: 'locked btc age, value = locked amount * locked blocks',
    })
    @IsOptional()
    @IsNumber()
    lockedBtcAge!: number;
    @ApiPropertyOptional({
        type: [Number],
        description: 'allowed locked btc amounts 0:blue amount,1:red amount unit: sat.',
    })
    @IsOptional()
    @IsNumber()
    lockedBtcAmounts!: number[];
}
