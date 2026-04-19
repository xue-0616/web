import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';
import { ApHistoryListOutPut } from './issue.ap.output';

export class ShowActionPointHistoryOutput {
    @ApiProperty({
        type: Number,
    })
    @IsNumber()
    total: any;
    @ApiProperty({
        type: [ApHistoryListOutPut],
    })
    @IsArray()
    list: any;
}
