// Recovered from dist/guardian.link.input.dto.js.map (source: ../../../../src/modules/otp/dtos/guardian.link.input.dto.ts)

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendGuardianLinkInput {
    @ApiProperty({ type: String, description: 'guardian email address' })
    @IsEmail()
    @IsNotEmpty()
    email!: string;
}
