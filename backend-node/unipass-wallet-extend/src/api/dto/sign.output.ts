import { ApiProperty } from '@nestjs/swagger';

export class IsValidOutput {
    @ApiProperty({
        type: Boolean,
        description: 'Signature is Valid',
    })
    isValid!: boolean;
}
