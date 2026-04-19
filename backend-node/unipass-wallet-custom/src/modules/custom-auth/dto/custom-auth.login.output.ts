import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnipassInfo } from './auth.account.info.output';

export class CustomAuthLoginOutput {
    @ApiProperty({ type: String })
    authorization: any;
    @ApiProperty({ type: Boolean })
    isRegistered: any;
    @ApiPropertyOptional({
        type: UnipassInfo,
    })
    unipassInfo: any;
}
