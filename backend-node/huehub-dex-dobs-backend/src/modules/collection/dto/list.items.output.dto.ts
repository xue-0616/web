import { ApiProperty } from '@nestjs/swagger';

export class ListItemsOutputDto {
    @ApiProperty({
        type: [Number],
        description: 'item ids',
    })
    itemIds!: number[];
}
