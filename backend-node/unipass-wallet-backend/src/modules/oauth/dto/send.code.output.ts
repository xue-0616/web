import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject } from 'class-validator';
import { AuthAccountInfoOutput } from '../../account/dto';

export class OAuthSendCodeOutput {
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    provider: any;
}

export class LoginOutput extends AuthAccountInfoOutput {
    @ApiPropertyOptional({
        type: Number,
    })
    @IsNumber()
    provider: any;
    @ApiPropertyOptional({
        type: Object,
    })
    @IsObject()
    cognitoResult: any;
}
