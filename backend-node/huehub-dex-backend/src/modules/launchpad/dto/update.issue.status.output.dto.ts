import { ApiProperty } from '@nestjs/swagger';

export class UpdateIssueStatusOutputDto {
    @ApiProperty({
        type: Boolean,
    })
    statue: boolean;
}
