import { Chain } from '../../../common/genericChain';
import { getResponseType } from '../../../common/dto/response';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class FavoriteDto {
    @ApiProperty()
    @IsInt()
    @Min(0)
    chain!: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    poolAddress!: string;
}
export class FavoriteResponse extends getResponseType(undefined) {
}
