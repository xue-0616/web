import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UserAuthDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(128)
    userAddr!: string;
}
