import { ApiProperty } from '@nestjs/swagger';

export class ActionOutputDto {
    @ApiProperty()
    transaction!: string;
}
