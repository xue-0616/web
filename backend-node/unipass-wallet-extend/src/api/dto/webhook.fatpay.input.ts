import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class FatPayWebhookBodyInput {
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    orderId!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    orderStatus!: number;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    userId!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    payTime!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    deliverTime!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    finishTime!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    fiatCurrency!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    currencyAmount!: number;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    cryptoCurrency!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    cryptoCurrencyCode!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    cryptoCurrencyAmount!: number;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    cryptoCurrencyUnitPrice!: number;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    walletAddress!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    walletAddressTag!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    gasFee!: number;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    gasFeeUnit!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    platformFee!: number;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    platformFeeUnit!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    totalFee!: number;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    totalFeeUnit!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    payment!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    txHash!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    network!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    blockchainExplorer!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    ext!: string;
}
