import { TradingStrategy } from '../entities/tradingStrategy.entity';
import { TradingStrategyItem, TradingStrategyItemType } from '../entities/tradingStrategyItem.entity';
import { getResponseType } from '../../../common/dto/response';

export enum ItemTypeDto {
    StopLoss = "StopLoss",
    TakeProfit = "TakeProfit",
}
export class TradingStrategyItemDto {
}
export class TradingStrategyDto {
}
export class TradingStrategiesDto {
    strategies!: TradingStrategyDto[];
}
export function getTradingStrategyDto(strategy: any, items: any) {
    return {
        id: strategy.id,
        name: strategy.name,
        items: items.map(getTradingStrategyItemDto),
    };
}
export function getTradingStrategyItemDto(item: any) {
    return {
        id: item.id,
        itemType: getItemTypeDto(item.itemType),
        trigger: item.trigger,
        sellRate: item.sellRate,
    };
}
export function getItemTypeDto(itemType: TradingStrategyItemType): ItemTypeDto {
    switch (itemType) {
        case TradingStrategyItemType.StopLoss: {
            return ItemTypeDto.StopLoss;
        }
        case TradingStrategyItemType.TakeProfit: {
            return ItemTypeDto.TakeProfit;
        }
        default: {
            throw new Error(`Unknown strategy item type: ${itemType}`);
        }
    }
}
export function getItemType(itemTypeDto: ItemTypeDto): TradingStrategyItemType {
    switch (itemTypeDto) {
        case ItemTypeDto.StopLoss: {
            return TradingStrategyItemType.StopLoss;
        }
        case ItemTypeDto.TakeProfit: {
            return TradingStrategyItemType.TakeProfit;
        }
        default: {
            throw new Error(`Unknown item type DTO: ${itemTypeDto}`);
        }
    }
}
export class TradingStrategyResponse extends getResponseType(TradingStrategyDto) {
}
export class TradingStrategiesResponse extends getResponseType(TradingStrategiesDto) {
}
export class DeleteTradingStrategyResponse extends getResponseType(null) {
}
