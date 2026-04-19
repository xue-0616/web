import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ConsumeGasInput {
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    chainId: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    relayerTxHash: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    chainTxHash: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    relayerSig: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    consumedGasUsed: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    consumedGasPrice: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    errorReason: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    status: any;
}
