import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CheckKeysetOutput {
    @ApiPropertyOptional({
        description: 'new keyset hash',
    })
    @IsString()
    @IsNotEmpty()
    newKeysetHash: any;
}
