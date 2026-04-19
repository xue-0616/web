import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { Expose } from 'class-transformer';

import {
    MAX_KEY_ENCRYPTED_CHARS,
    MIN_KEY_ENCRYPTED_CHARS,
} from './encrypted-key.validator';

export class SaveEncryptedKeyInputDto {
    @ApiProperty({
        name: 'key_encrypted',
        type: String,
        description: `Base64 (or base64url) ciphertext, length ${MIN_KEY_ENCRYPTED_CHARS}-${MAX_KEY_ENCRYPTED_CHARS} chars.`,
    })
    @IsString()
    @Length(MIN_KEY_ENCRYPTED_CHARS, MAX_KEY_ENCRYPTED_CHARS, {
        message: `key_encrypted length must be in [${MIN_KEY_ENCRYPTED_CHARS}, ${MAX_KEY_ENCRYPTED_CHARS}]`,
    })
    @Matches(/^[A-Za-z0-9+/_-]+={0,2}$/, {
        message: 'key_encrypted must be base64 / base64url',
    })
    @Expose({ name: 'key_encrypted' })
    keyEncrypted: string;

    @ApiProperty({
        type: String,
        description: 'Solana pubkey in base58 (32-44 chars).',
    })
    @IsString()
    @Matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, {
        message: 'address must be a valid Solana base58 pubkey',
    })
    address: string;
}
