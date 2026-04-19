import { OrderTypeDto, TradingOrderStatusDto } from './order.response.dto';
import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsEnum, IsInt, Min, Max, IsArray } from 'class-validator';

export class CreateOrderDto {
    @IsEnum(OrderTypeDto)
    orderType!: OrderTypeDto;

    @IsString()
    @IsNotEmpty()
    amount!: string;

    @IsOptional()
    @IsString()
    outAmount!: string | null;

    @IsBoolean()
    isAntiMev!: boolean;

    @IsString()
    @IsNotEmpty()
    slippagePercent!: string;

    @IsString()
    @IsNotEmpty()
    priorityFee!: string;

    @IsString()
    @IsNotEmpty()
    briberyAmount!: string;

    @IsOptional()
    @IsString()
    pool!: string | null;

    @IsString()
    @IsNotEmpty()
    walletId!: string;

    @IsOptional()
    @IsString()
    triggerPriceUsd!: string | null;

    @IsOptional()
    @IsString()
    autoTradeEventId!: string | null;
}
export enum TradingOrderByDto {
    CreatedTime = "CreatedTime",
    UpdatedTime = "UpdatedTime",
}
export class GetOrdersReqDto {
    @IsOptional()
    @IsString()
    pool?: string | null;

    @IsOptional()
    @IsString()
    startId?: string | null;

    @IsOptional()
    @IsArray()
    statuses?: TradingOrderStatusDto[] | null;

    @IsOptional()
    @IsArray()
    orderTypes?: OrderTypeDto[] | null;

    @IsOptional()
    @IsString()
    orderBy?: string | null;

    @IsOptional()
    @IsString()
    tokenMint?: string | null;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number | null;
}
export class CancelOrderDto {
    @IsString()
    @IsNotEmpty()
    id!: string;
}
