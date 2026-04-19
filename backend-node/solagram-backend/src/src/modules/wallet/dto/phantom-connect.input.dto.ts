import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class PhantomConnectInputDto {
    @ApiPropertyOptional({
        type: String,
        description: 'https://docs.phantom.app/phantom-deeplinks/provider-methods/connect#approve',
    })
    @IsOptional()
    phantom_encryption_public_key!: string;
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
