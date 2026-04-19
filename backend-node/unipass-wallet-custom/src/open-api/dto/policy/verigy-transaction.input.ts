import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class VerifyTransactionInput {
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    chainId: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    userAddress: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    nonce: any;
    @ApiProperty({
        type: (Array),
    })
    @IsArray()
    @IsNotEmpty()
    customTransactions: any;
    @ApiPropertyOptional({
        type: Object,
    })
    @IsObject()
    @IsOptional()
    feeTransaction: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    relayerTxHash: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    estimateConsumedFee: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    gasFreeSig: any;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    @IsOptional()
    userPaidTokenAmount: any;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    @IsOptional()
    userPaidTokenUsdPrice: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    nativeTokenUsdPrice: any;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    @IsOptional()
    userPaidTokenDecimal: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    userPaidToken: any;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    @IsOptional()
    expires: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    relayerSig: any;
}
