import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum AppType {
    Wallet = 0,
    Phantom = 1,
}

export enum MessageType {
    Message = 0,
    TxRawData = 1,
}

export class AppQueryInputDto {
    @ApiProperty({
        type: String,
        description: 'hash or nonce',
    })
    @IsString()
    key!: string;
    @ApiProperty({
        enum: AppType,
        description: 'app type enum,0:Wallet,1:Phantom',
        example: AppType.Phantom,
    })
    @IsEnum(AppType)
    @Transform(({ value }) => parseInt(value, 10))
    walletType!: AppType;
    @ApiPropertyOptional({
        enum: MessageType,
        description: 'app type enum,0:Message,1:txRawData',
        example: MessageType.TxRawData,
    })
    @IsOptional()
    @IsEnum(MessageType)
    @Transform(({ value }) => parseInt(value, 10))
    messageType!: MessageType;
}
