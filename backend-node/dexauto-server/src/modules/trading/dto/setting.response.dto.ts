import { ChainDto, getChainDto, getChainId } from '../../../common/dto/chain';
import { TradingSetting } from '../entities/tradingSetting.entity';
import { ChainId } from '../../../common/genericChain';
import { getResponseType } from '../../../common/dto/response';
import Decimal from 'decimal.js';

export class TradingSettingDto {
}
export class TradingSettingsDto {
}
export function getTradingSettingDto(setting: any) {
    return {
        id: setting.id,
        chain: getChainDto(setting.chain),
        chainId: setting.chainId === null ? null : getChainId(setting.chainId),
        isMevEnabled: setting.isMevEnabled,
        slippagePercent: new Decimal(setting.slippage).mul(100).toString(),
        priorityFee: setting.priorityFee,
        briberyAmount: setting.briberyAmount,
    };
}
export class TradingSettingsResponse extends getResponseType(TradingSettingsDto) {
}
export class TradingSettingResponse extends getResponseType(TradingSettingDto) {
}
