import { ApiProperty } from '@nestjs/swagger';

export class DeployOutputDto {
    @ApiProperty({
        type: String,
        description: 'depoly token btc tx hash',
    })
    btcTxHash!: string;
}
