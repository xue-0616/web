import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class AppWalletConnectInputDto {
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    phantom_encryption_public_key: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    solflare_encryption_public_key: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    wallet_encryption_public_key: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    nonce: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    data: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    errorCode: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    errorMessage: string;
}
