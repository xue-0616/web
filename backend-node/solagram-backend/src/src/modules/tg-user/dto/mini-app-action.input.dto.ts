import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { AppType, OpenActionType, OpenSource } from '../../../database/entities/open-app-action.entity';

export class MiniAppActionInputDto {
    @ApiPropertyOptional({
        type: String,
        description: 'short_code is a parameter in startapp',
    })
    @IsOptional()
    short_code!: string;
    @ApiPropertyOptional({
        type: String,
        description: 'chat_id is a parameter in startapp',
    })
    @IsOptional()
    chat_id!: string;
    @ApiProperty({
        type: Number,
        description: 'Telegram.WebApp.initDataUnsafe',
    })
    @IsNumber()
    user_id!: number;
    @ApiProperty({
        enum: OpenSource,
        description: 'mini app open source : 0 - bot, 1 - blink mini app',
        example: OpenSource.Bot,
    })
    @IsEnum(OpenSource)
    source!: OpenSource;
    @ApiProperty({
        enum: AppType,
        description: 'mini app open type:0- BlinkMiniApp, 1 - WalletMiniAPp',
        example: AppType.BlinkMiniApp,
    })
    @IsEnum(AppType)
    app_type!: AppType;
    @ApiProperty({
        enum: OpenActionType,
        description: 'mini app open action: 0:Show home,1:Connect,2:SignTransaction,',
        example: OpenActionType.ShowHome,
    })
    @IsEnum(OpenActionType)
    action!: OpenActionType;
}
