import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ApIssueInfo {
    @ApiProperty({
        type: String,
    })
    address: any;
    @ApiProperty({
        type: String,
    })
    @IsNumber()
    ap: any;
}

export class IssueActionPointInput {
    @ApiProperty({
        type: [ApIssueInfo],
    })
    @IsArray()
    apIssueList: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    timestamp: any;
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
    message: any;
}

export class AdminGetActionPointBalanceInput {
    @ApiProperty({
        type: [String],
    })
    @IsArray()
    addresses: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    timestamp: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    adminSig: any;
}
