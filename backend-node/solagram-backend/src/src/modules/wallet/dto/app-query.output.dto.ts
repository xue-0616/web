import { ApiPropertyOptional } from '@nestjs/swagger';

export class AppQueryOutputDto {
    @ApiPropertyOptional({
        type: String,
    })
    public_key!: string;
    @ApiPropertyOptional({
        type: String,
    })
    data!: string;
    @ApiPropertyOptional({
        type: String,
    })
    nonce!: string;
    @ApiPropertyOptional({
        type: String,
    })
    method!: string;
    @ApiPropertyOptional({ type: String })
    error_message!: string;
    @ApiPropertyOptional({ type: String })
    error_code!: string;
}
