import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateIssueStatus {
    @ApiProperty({
        type: String,
    })
    issueTxhash: string;
    @ApiProperty({
        type: String,
    })
    mintTxHash: string;
}

export class UpdateIssueStatusInputDto {
    @ApiProperty({
        type: [UpdateIssueStatus],
    })
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => UpdateIssueStatus)
    list: UpdateIssueStatus[];
    @ApiProperty({
        type: String,
        description: 'issue script sig',
    })
    sig: string;
    @ApiProperty({
        type: String,
        description: 'issue script sig message',
    })
    sigMessage: string;
}
