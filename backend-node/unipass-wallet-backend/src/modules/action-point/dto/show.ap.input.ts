import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class ShowActionPointHistoryInput {
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    limit: any;
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    page: any;
}

export class GetUsdToAPInput {
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    usd: any;
}
