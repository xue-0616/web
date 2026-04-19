import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmptyObject, IsObject, IsOptional, IsString } from 'class-validator';
import { MasterKeyInput } from './account.master.key.input';

export class Web3AuthSignature {
    @ApiProperty({
        type: String,
    })
    @IsString()
    address: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    sig: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    message: any;
}

export class CustomAuthRegisterInput {
    @ApiProperty({
        type: String,
        default: '[]',
    })
    @IsString()
    keysetJson: any;
    @ApiProperty({
        type: MasterKeyInput,
    })
    @IsObject()
    @IsNotEmptyObject()
    masterKey: any;
    @ApiProperty({
        type: String,
    })
    @IsString()
    appId: any;
    @ApiPropertyOptional({
        type: Web3AuthSignature,
    })
    @IsObject()
    @IsOptional()
    web3auth: any;
    @ApiPropertyOptional({
        type: String,
        default: '30d',
    })
    @IsString()
    @IsOptional()
    expirationInterval: any;
}
