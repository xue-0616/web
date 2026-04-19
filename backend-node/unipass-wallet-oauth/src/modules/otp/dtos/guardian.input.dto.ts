// Recovered from dist/guardian.input.dto.js.map (source: ../../../../src/modules/otp/dtos/guardian.input.dto.ts)

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyGuardianInput {
    @ApiProperty({ type: String, description: 'guardian verification data' })
    @IsString()
    @IsNotEmpty()
    data!: string;
}
