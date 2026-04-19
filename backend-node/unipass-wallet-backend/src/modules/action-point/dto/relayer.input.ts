import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RelayerInfo {
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    address: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    relayerUrl: any;
}

export class RelayerConfigInput {
    @ApiProperty({
        type: [RelayerInfo],
    })
    @IsArray()
    list: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    @IsNotEmpty()
    adminSig: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    timestamp: any;
}
