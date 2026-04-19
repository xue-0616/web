import { IsArray, IsNumber } from 'class-validator';

export class TokensStatisticFixInput {
    @IsNumber()
    time!: number;
    @IsArray()
    tokenIds!: number[];
}
