import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmptyObject, IsObject, IsOptional, IsString } from 'class-validator';
import { MasterKeyInput } from '../../account/dto';
import { Web3auth } from './custom-auth.login.input';

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
        type: Web3auth,
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
