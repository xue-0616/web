import { ItemTypeDto } from './strategy.response.dto';
import { IsString, IsNotEmpty, IsEnum, IsArray, ValidateNested, ArrayMinSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStrategyItemDto {
    @IsEnum(ItemTypeDto)
    itemType!: ItemTypeDto;

    @IsString()
    @IsNotEmpty()
    trigger!: string;

    @IsString()
    @IsNotEmpty()
    sellRate!: string;
}
export class CreateStrategyDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(16)
    name!: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateStrategyItemDto)
    items!: CreateStrategyItemDto[];
}
