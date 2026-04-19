import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountStatus } from '../../entities';

export class UnipassInfo {
    @ApiProperty({
        type: String,
        description: 'uniapss account keyset json data',
    })
    keyset: any;
    @ApiProperty({
        type: String,
        description: 'account address',
    })
    address: any;
    @ApiProperty({
        type: String,
        description: 'uniapss account keystore json',
    })
    keystore: any;
    @ApiProperty({
        type: Number,
        description: 'uniapss key type 0: MPC, 1:snaps ，2 Metamask',
    })
    keyType: any;
}

export class UpJwtToken {
    @ApiProperty({
        type: String,
        description: 'unipas jwt refresh token',
    })
    refreshToken: any;
    @ApiProperty({
        type: String,
        description: 'unipas jwt authorization token',
    })
    authorization: any;
}

export class AuthAccountInfoOutput {
    @ApiProperty({
        type: Number,
    })
    provider: any;
    @ApiProperty({
        type: Boolean,
        description: 'account is registered in unipass',
        default: true,
    })
    isRegistered: any;
    @ApiProperty({
        type: String,
        description: 'unipas jwt authorization token',
    })
    authorization: any;
    @ApiPropertyOptional({
        enum: AccountStatus,
        enumName: 'AccountStatus',
        description: 'account status [0,1,2,3]',
        default: 1,
    })
    isPending: any;
    @ApiPropertyOptional({
        type: Date,
        description: 'account create at',
    })
    createdAt: any;
    @ApiPropertyOptional({
        type: String,
        description: 'unipas sign token',
    })
    upSignToken: any;
    @ApiPropertyOptional({
        type: UnipassInfo,
        description: 'unipass account info',
    })
    unipassInfo: any;
}
