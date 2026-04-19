import { IsString, IsNotEmpty } from 'class-validator';

export class DeleteStrategyDto {
    @IsString()
    @IsNotEmpty()
    id!: string;
}
