import { ApiPropertyOptional } from '@nestjs/swagger';

export class TssOutput {
    @ApiPropertyOptional({
        description: 'tss start_keygen return data',
    })
    tssRes: any;
}
