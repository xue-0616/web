import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class Web3authConfig {
    @ApiProperty({
        type: String,
    })
    @IsString()
    clientId: any;
    @ApiPropertyOptional({
        type: String,
    })
    verifierName: any;
}

export class CustomAuthConfigOutput {
    @ApiProperty({
        type: String,
    })
    unipassRelayerUrl: any;
    @ApiProperty({
        type: Web3authConfig,
    })
    @IsNumber()
    web3authConfig: any;
    @ApiProperty({
        type: String,
    })
    jwtVerifierIdKey: any;
}
