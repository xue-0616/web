import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export enum Role {
    Owner = 0,
    AssetsOp = 1,
    Guardian = 2,
}

export class RoleWeight {
    @ApiPropertyOptional({
        description: 'Role owner weight',
    })
    ownerWeight: any;
    @ApiPropertyOptional({
        description: 'Role assetsOp weight',
    })
    assetsOpWeight: any;
    @ApiPropertyOptional({
        description: 'Role guardian weight',
    })
    guardianWeight: any;
}

export class KeysetWeightData {
    @ApiPropertyOptional({
        description: 'keyset key hash',
    })
    key: any;
    @ApiPropertyOptional({
        description: 'keyset raw data',
    })
    raw: any;
    @ApiPropertyOptional({
        description: 'keyset data weight',
    })
    roleWeight: any;
    @ApiPropertyOptional({
        description: 'key role',
    })
    role: any;
    @ApiPropertyOptional({
        description: 'key role weight',
    })
    weight: any;
}

export class AccountKeysetOutput {
    @ApiPropertyOptional({ description: 'query send recovery email address' })
    email: any;
    @ApiPropertyOptional({
        description: 'get keyset auth object or string',
    })
    @IsNumber()
    threshold: any;
    @ApiPropertyOptional({
        description: 'account keys list',
    })
    keys: any;
}
