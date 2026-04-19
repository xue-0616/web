import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectStatus {
    ComingSoon = 0,
    LiveNow = 1,
    Finished = 2,
}

export class LaunchpadStatus {
    @ApiProperty({
        type: Number,
        example: 1,
        description: 'token id',
    })
    id: number;
    @ApiPropertyOptional({
        type: Number,
        example: 1719574576,
    })
    startTime: number;
    @ApiPropertyOptional({
        type: Number,
        example: 1729574576,
    })
    endTime: number;
    @ApiPropertyOptional({
        type: String,
        example: 'Whitelist',
    })
    roundName: string;
    @ApiProperty({
        enum: ProjectStatus,
        example: ProjectStatus.ComingSoon,
        description: 'launchpad status:0:ComingSoon,1:LiveNow,2:Finished',
    })
    status: ProjectStatus;
}

export class LaunchpadProjectOutputDto {
    @ApiProperty({
        type: [LaunchpadStatus],
    })
    list: LaunchpadStatus[];
}
