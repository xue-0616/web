import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class NotifiesQueryDto {
    @IsOptional()
    @IsString()
    startId?: string | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number | null;
}
