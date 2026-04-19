import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum RampPlatform {
    AlchemyPay = "alchemyPay",
    WhaleFin = "whaleFin",
    FatPay = "fatPay",
    BinanceConnect = "binanceConnect",
}

export class GetOnRampUrlInput {
    @ApiProperty({
        enum: RampPlatform,
        enumName: 'RampPlatform',
    })
    @IsEnum(RampPlatform, {
        message: 'need in array [alchemyPay,whaleFin,fatPay,binanceConnect]',
    })
    platform: any;
    @ApiPropertyOptional({
        type: String,
        description: 'the ramp platform support network',
    })
    @IsOptional()
    chain: any;
}
