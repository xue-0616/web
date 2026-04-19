import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class WalletConnectInputDto {
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    encryption_public_key!: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    nonce!: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    data!: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    errorCode!: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    errorMessage!: string;
}
