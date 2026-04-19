import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class PhantomSignMessageInputDto {
    @ApiPropertyOptional({
        type: String,
        description: 'https://docs.phantom.app/phantom-deeplinks/provider-methods/signmessage#approve',
    })
    @IsOptional()
    nonce!: string;
    @ApiProperty({ type: String })
    @IsOptional()
    data!: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    errorCode!: string;
    @ApiPropertyOptional({ type: String })
    @IsOptional()
    errorMessage!: string;
}
