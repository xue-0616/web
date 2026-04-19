import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetSyncStatusInput {
    @ApiProperty({
        type: String,
        description: 'need query sync chain node name',
    })
    @IsString()
    @IsNotEmpty()
    authChainNode: any;
    @ApiPropertyOptional({
        type: String,
        description: 'need send sync email',
    })
    @IsOptional()
    sendSyncEmail: any;
}
