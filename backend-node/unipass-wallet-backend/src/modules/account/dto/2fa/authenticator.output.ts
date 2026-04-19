import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthType } from '../../entities';

export class AddAuthenticatorOutput {
    @ApiProperty({
        type: String,
        description: '2fa open status: 0:close, 1:open',
    })
    status: any;
    @ApiProperty({
        type: Boolean,
        description: '2fa data bind status :true(bind), false(unbind)',
    })
    bind: any;
}

export class DeleteAuthenticatorOuput {
    @ApiProperty({
        type: Boolean,
        description: '2fa data bind status :true(bind), false(unbind)',
    })
    bind: any;
}

export class AuthenticatorListOutput {
    @ApiProperty({
        enum: AuthType,
        enumName: 'AuthType',
        description: '2fa type',
    })
    type: any;
    @ApiProperty({
        type: String,
        description: '2fa value',
    })
    value: any;
    @ApiProperty({
        type: Number,
        description: '2fa status',
    })
    status: any;
    @ApiPropertyOptional({
        type: String,
        description: 'is Showre google reCaptcha',
    })
    isShowReCaptcha: any;
}
