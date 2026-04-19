import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmptyObject, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UserInfo {
    @ApiProperty({
        type: Number,
        description: 'Telegram user id — positive integer within JS safe range.',
    })
    // BUG-S4 (LOW) fix: @IsNumber() alone accepts floats, NaN, negative
    // and near-MAX_SAFE_INTEGER overflow values that later get
    // string-templated into Cognito's Username and redis cache keys.
    // Telegram user ids are positive 53-bit-safe integers, so enforce
    // that shape here.
    @IsInt()
    @Min(1)
    @Max(Number.MAX_SAFE_INTEGER)
    id!: number;
    @ApiProperty({
        type: String,
    })
    @IsString()
    first_name!: string;
    @ApiProperty({
        type: String,
    })
    @IsString()
    last_name!: string;
    @ApiProperty({
        type: String,
    })
    @IsString()
    username!: string;
    @ApiProperty({
        type: String,
    })
    @IsString()
    language_code!: string;
    @ApiPropertyOptional({
        type: Boolean,
    })
    @IsOptional()
    added_to_attachment_menu!: boolean;
    @ApiPropertyOptional({
        type: Boolean,
    })
    @IsOptional()
    allows_write_to_pm!: boolean;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    photo_url!: string;
}

export class LoginInputDto {
    @ApiProperty({
        type: UserInfo,
        description: 'WebApp.initDataUnsafe.user',
    })
    @IsNotEmptyObject()
    user!: UserInfo;
    @ApiProperty({
        type: String,
        description: 'WebApp.initDataUnsafe.auth_date',
    })
    @IsString()
    auth_date!: string;
    @ApiProperty({
        type: String,
        description: 'WebApp.initDataUnsafe.hash',
    })
    @IsString()
    hash!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'WebApp.initDataUnsafe.query_id',
    })
    @IsOptional()
    query_id!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    chat_instance!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    chat_type!: string;
    @ApiPropertyOptional({
        type: String,
    })
    @IsOptional()
    start_param!: string;
    @ApiPropertyOptional({
        type: Number,
    })
    @IsOptional()
    can_send_after!: number;
    @ApiPropertyOptional({
        type: Object,
    })
    @IsOptional()
    chat!: any;
    @ApiPropertyOptional({
        type: UserInfo,
    })
    @IsOptional()
    receiver!: UserInfo;
}
