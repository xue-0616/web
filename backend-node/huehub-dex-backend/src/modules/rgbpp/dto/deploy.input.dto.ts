import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeployInputDto {
    @ApiProperty({
        type: String,
        description: ' Launch btc sig transaction psbt sig hash',
    })
    @IsString()
    launchBtcTx!: string;
    @ApiProperty({
        type: String,
        description: 'prepare id',
    })
    @IsString()
    id!: string;
}
