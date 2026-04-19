import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * BUG-S2 (MEDIUM) DTO hardening. The /wallet/message relay stores
 * caller-supplied payloads in Redis keyed by `nonce` /
 * `encryption_public_key`. Without a proper signed-session layer
 * (out of scope for this commit — needs JWT rollout), the best we
 * can do here is refuse malformed / oversized shapes so an attacker
 * can't trivially flood Redis or smuggle arbitrary ASCII into other
 * callers' logs.
 */
const HEX_OR_BASE58 = /^[0-9A-Za-z]{16,88}$/;

export class WalletConnectInputDto {
    @ApiPropertyOptional({
        type: String,
        description: 'Alphanumeric, 16-88 chars (base58 pubkey or hex).',
    })
    @IsOptional()
    @IsString()
    @Matches(HEX_OR_BASE58, {
        message: 'encryption_public_key must be 16-88 alphanumeric chars',
    })
    encryption_public_key!: string;

    @ApiPropertyOptional({
        type: String,
        description: 'Alphanumeric nonce, 16-88 chars.',
    })
    @IsOptional()
    @IsString()
    @Matches(HEX_OR_BASE58, {
        message: 'nonce must be 16-88 alphanumeric chars',
    })
    nonce!: string;

    @ApiPropertyOptional({
        type: String,
        description: 'Opaque relay payload, ≤ 8192 chars.',
    })
    @IsOptional()
    @IsString()
    @Length(0, 8192, {
        message: 'data must be ≤ 8192 chars',
    })
    data!: string;

    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    @Length(0, 64)
    errorCode!: string;

    @ApiPropertyOptional({ type: String })
    @IsOptional()
    @IsString()
    @Length(0, 512)
    errorMessage!: string;
}
