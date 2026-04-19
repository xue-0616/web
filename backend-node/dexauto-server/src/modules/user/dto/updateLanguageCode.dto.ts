import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateLanguageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    language!: string;
}
