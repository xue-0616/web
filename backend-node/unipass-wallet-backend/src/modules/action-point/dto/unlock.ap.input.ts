import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export enum UnlockStatus {
    SUCCESS = "success",
    FAIL = "fail",
}

export class UnlockActionPointInput {
    @ApiProperty({
        enum: UnlockStatus,
    })
    @IsEnum(UnlockStatus)
    status: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    historyId: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    adminSig: any;
    @ApiPropertyOptional({
        type: String,
    })
    @IsString()
    @IsOptional()
    chainTxHash: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    timestamp: any;
}
