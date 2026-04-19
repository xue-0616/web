import { GenericAddress } from './genericAddress';
import Decimal from 'decimal.js';
import { TradingOrderStatus } from '../modules/trading/entities/tradingOrder.entity';
import axios from 'axios';
import { Chain } from './genericChain';
import { BadRequestException, UnknownError } from '../error';
import { assertNever, isNullOrUndefined } from './utils';
import { Logger } from '@nestjs/common';

export interface ContractOpKey {
    contract: GenericAddress;
    opKey: GenericAddress;
}

export interface ContractOpKeys {
    opKeys: ContractOpKey[];
}

export interface SwapTransactionRes {
    status: SwapTransactionStatus;
    txId: string | null;
    errorReason: string | null;
}

/** Default request timeout for trading server calls (30 seconds). */
const TRADING_CLIENT_TIMEOUT_MS = 30_000;

export class TradingClient {
    logger: any;
    instance: any;
    constructor(url: string) {
        this.logger = new Logger(TradingClient.name);
        this.instance = axios.create({
            baseURL: url,
            timeout: TRADING_CLIENT_TIMEOUT_MS,
        });
    }
    async post(path: any, req: any) {
        const res = await this.instance.post(path, req);
        if (res.data.code !== 0) {
            if (res.data.code === 2) {
                this.logger.error(`bad request: ${res.data.message}`);
                throw new BadRequestException(res.data.message);
            }
            this.logger.error(`send tx failed, error code: ${res.data.code}, message: ${res.data.message}`);
            throw new UnknownError(`send tx failed, error code: ${res.data.code}, message: ${res.data.message}`);
        }
        return res.data;
    }
    async createOpKey(contract: any): Promise<ContractOpKey> {
        const response = await this.post('/api/v1/dexauto-trading/trading-account/op-key/create', {
            tradingAccountPda: contract.address(),
        });
        return getContractOpKey(response.data);
    }
    async opKeys(contracts: any): Promise<ContractOpKeys> {
        const response = await this.post('/api/v1/dexauto-trading/trading-account/op-keys', {
            tradingAccountPdas: contracts.map((contract: any) => contract.address()),
        });
        return getContractOpKeys(response.data);
    }
    async swap(req: any): Promise<SwapTransactionRes> {
        const { amountSpecified, baseIn, briberyAmount, feeRate, inputMint, isAntiMev, maxPriorityFee, orderId, otherAmountThreshold, outputMint, poolId, slippage, tradingAccountPda, swapType, triggerPriceUsd, consensusVotes, isSell, } = req;
        const response = await this.post('/api/v1/dexauto-trading/trading-account/swap', {
            swapType,
            amountSpecified: amountSpecified.toString(),
            baseIn,
            briberyAmount: briberyAmount.toString(),
            feeRateBps: feeRate.mul(10000).toFixed(0).toString(),
            inputMint,
            isAntiMev,
            maxPriorityFee: maxPriorityFee.toString(),
            orderId,
            otherAmountThreshold: isNullOrUndefined(otherAmountThreshold)
                ? null
                : otherAmountThreshold.toString(),
            outputMint,
            poolId,
            slippageBps: slippage.mul(10000).toFixed(0),
            tradingAccountPda,
            triggerPriceUsd: isNullOrUndefined(triggerPriceUsd)
                ? null
                : triggerPriceUsd.toFixed(),
            // Tier-weighted consensus votes + is_sell drive retry policy
            // and Jito tip tier in the Rust trading server. Default 0/false
            // preserves back-compat for callers that don't set them.
            consensusVotes: consensusVotes ?? 0,
            isSell: isSell ?? false,
        });
        return response.data;
    }
    async cancelOrder(id: any): Promise<SwapTransactionRes> {
        const response = await this.post('/api/v1/dexauto-trading/trading-account/tx/cancel', {
            orderId: id,
        });
        return response.data;
    }
}
function getContractOpKey(res: any) {
    return {
        contract: new GenericAddress(Chain.Solana, res.tradingAccountPda),
        opKey: new GenericAddress(Chain.Solana, res.opKey),
    };
}
export enum SwapTransactionStatus {
    Created = 'Created',
    Success = 'Success',
    Failed = 'Failed',
    Cancelled = 'Cancelled',
}
export function getTradingOrderStatus(status: any) {
    switch (status) {
        case SwapTransactionStatus.Created: {
            return TradingOrderStatus.Created;
        }
        case SwapTransactionStatus.Success: {
            return TradingOrderStatus.Success;
        }
        case SwapTransactionStatus.Failed: {
            return TradingOrderStatus.Failed;
        }
        case SwapTransactionStatus.Cancelled: {
            return TradingOrderStatus.Cancelled;
        }
        default: {
            assertNever(status);
        }
    }
}
export enum SwapType {
    QuickSwap = 'QuickSwap',
    LowerPriceSwap = 'LowerPriceSwap',
    GreaterPriceSwap = 'GreaterPriceSwap',
}
function getContractOpKeys(res: any) {
    return {
        opKeys: res.opKeys.map(getContractOpKey),
    };
}
