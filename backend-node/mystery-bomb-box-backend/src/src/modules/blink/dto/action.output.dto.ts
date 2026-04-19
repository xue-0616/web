import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActionGetResponseDto {
    @ApiProperty()
    icon!: string;
    @ApiProperty()
    title!: string;
    @ApiProperty()
    description!: string;
    @ApiProperty()
    label!: string;
    @ApiPropertyOptional()
    disabled!: boolean;
    @ApiPropertyOptional()
    links!: {
        actions: LinkedAction[];
    };
}

export class LinkedAction {
    @ApiProperty()
    href!: string;
    @ApiProperty()
    label!: string;
    @ApiPropertyOptional()
    parameters!: any;
}
