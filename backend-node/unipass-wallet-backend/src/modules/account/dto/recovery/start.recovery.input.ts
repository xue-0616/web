import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional } from 'class-validator';
import { Auth2FaCodeToken } from '../2fa/login.input';

export class StartRecoveryInput {
    @ApiProperty({
        type: [String],
        description: 'send start recovery verify email list',
    })
    @IsArray()
    verificationEmailHashs: any;
    @ApiPropertyOptional({
        type: [Auth2FaCodeToken],
        description: 'account login 2fa verify token',
    })
    @IsOptional()
    auth2FaToken: any;
}
