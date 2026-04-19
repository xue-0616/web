import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { getAddress } from 'ethers';
import { IStatisticsRegisterDto } from '../../dto/app_sanp.dto';
import { CustomTxFee, FeeInfo, GasConsumeDetailsInfo } from '../utils/interface';
import { SnapAppDbService } from './snap-app-db.service';
import { LoggerService } from '../../../../shared/logger/logger.service';
import { BaseStatisticsService } from './base-statistics.server';
import { getChainConsumeUsdMap, getChainUsdMap, getConsumeList, getCustomDiscountMap, getGasFee, getPaymentSnapConsumeList, getPaymentSnapReceiveList, getReceiveList } from '../utils/payment-snap-gas.utils';
import { getTokenAmount, initTime, sortList } from '../utils/input.utils';
import { NATIVE_TOKEN_ADDRESS, nativeToken } from '../../chain/utils';

type StatisticsResponse<T> = {
    list: T[];
    pagination: { total: number; size: number; page: number };
};

@Injectable()
export class PaymentSnapGasStatisticsService {
    constructor(
        private readonly baseStatisticsService: BaseStatisticsService,
        private readonly snapAppDbService: SnapAppDbService,
        private readonly logger: LoggerService,
    ) {}

    async getGasReceiveList(dto: IStatisticsRegisterDto): Promise<StatisticsResponse<any>> {
        let { start, end } = dto;
        [start, end] = initTime(start, end);
        const snapAddress = await this.snapAppDbService.getSnapAddress();
        const [snapList, paymentList] = await Promise.all([
            this.baseStatisticsService.getRelayerTransaction(snapAddress, start, end, undefined, undefined, undefined, undefined),
            this.getPaymentTransaction(start, end, 'App'),
        ]);
        const [snap, payment] = await Promise.all([
            this.getDailyReceive(snapList, 'Snap'),
            this.getDailyReceive(paymentList, 'App'),
        ]);
        const list = getPaymentSnapReceiveList(snap, payment, start, end);
        return { list, pagination: { total: list.length, size: list.length, page: 1 } };
    }

    async getPaymentTransaction(start: string, end: string, app: string): Promise<FeeInfo[]> {
        const list = await this.snapAppDbService.getPaymentTransactionList(start, end);
        return list.map((item) => ({
            ...item,
            gasFee: getGasFee(item.chainId, item.gasLimit, item.gasPrice, this.logger),
            app,
        }));
    }

    async getDailyReceive(list: FeeInfo[], app: string): Promise<any[]> {
        const dayMap = new Map();
        for (const item of list) {
            if (item.feeAmount === '0') {
                continue;
            }
            let address = NATIVE_TOKEN_ADDRESS;
            try {
                if (item.feeToken && item.feeToken !== NATIVE_TOKEN_ADDRESS) {
                    address = getAddress(item.feeToken);
                }
            } catch (error) {
                this.logger.error(`[getDailyReceive] error ${error},item ${JSON.stringify(address)}`);
            }
            const chain = nativeToken[item.chainId]?.[address];
            const price = chain ? await this.baseStatisticsService.getTokenUsdPrice(chain.cid) : 1;
            const feeUsd = new Decimal(item.feeAmount || 0).mul(new Decimal(price)).toNumber();
            getChainUsdMap(dayMap, item.date, item.chainId, feeUsd);
        }
        return getReceiveList(dayMap, app);
    }

    async getGasConsumeList(dto: IStatisticsRegisterDto): Promise<StatisticsResponse<any>> {
        let { start, end } = dto;
        [start, end] = initTime(start, end);
        const [snapAddress, paymentAddress] = await Promise.all([
            this.snapAppDbService.getSnapAddress(),
            this.snapAppDbService.getPaymentAddress(),
        ]);
        const [snapList, paymentList] = await Promise.all([
            this.baseStatisticsService.getRelayerTransaction(snapAddress, start, end, undefined, undefined, undefined, undefined),
            this.baseStatisticsService.getRelayerTransaction(paymentAddress, start, end, undefined, undefined, undefined, undefined),
        ]);
        const [snap, payment] = await Promise.all([
            this.getDailyConsume(snapList, 'Snap'),
            this.getDailyConsume(paymentList, 'App'),
        ]);
        const list = getPaymentSnapConsumeList(snap, payment, start, end);
        return { list, pagination: { total: list.length, size: list.length, page: 1 } };
    }

    async getDailyConsume(list: FeeInfo[], app: string): Promise<any[]> {
        const dayMap = new Map();
        for (const item of list) {
            if (item.gasFee === '0') {
                continue;
            }
            const chain = nativeToken[item.chainId]?.[NATIVE_TOKEN_ADDRESS];
            const price = chain ? await this.baseStatisticsService.getTokenUsdPrice(chain.cid) : 1;
            const gasFeeUsd = new Decimal(item.gasFee || 0).mul(new Decimal(price)).toNumber();
            getChainConsumeUsdMap(dayMap, item.date, item.chainId, gasFeeUsd, parseFloat(item.gasFee || '0'), chain?.symbol || '');
        }
        return getConsumeList(dayMap, app);
    }

    async getGasConsumeDetailList(dto: IStatisticsRegisterDto): Promise<StatisticsResponse<GasConsumeDetailsInfo>> {
        let { start, end, page, limit } = dto as IStatisticsRegisterDto & { page?: number; limit?: number };
        [start, end] = initTime(start, end);
        page = page || 1;
        limit = limit || 10;
        const [snapAddress, paymentAddress] = await Promise.all([
            this.snapAppDbService.getSnapAddress(),
            this.snapAppDbService.getPaymentAddress(),
        ]);
        const where = `LIMIT ${(page - 1) * limit},${limit}`;
        const [snapDetails, paymentDetails, total] = await Promise.all([
            this.baseStatisticsService.getRelayerTransaction(snapAddress, start, end, true, where, false, 'Snap'),
            this.baseStatisticsService.getRelayerTransaction(paymentAddress, start, end, true, where, false, 'App'),
            this.snapAppDbService.getRelayerTransactionCount(snapAddress.concat(paymentAddress), start, end),
        ]);
        const details = snapDetails.concat(paymentDetails);
        const tx = details.map((detail: any) => detail.chainTxHash.replace('0x', ''));
        const customTxFeeList = await this.snapAppDbService.getCustomTxFeeList(tx, start, end);
        const list = await this.getGasDetailList(details, customTxFeeList);
        return { list, pagination: { total, size: limit, page } };
    }

    async getGasDetailList(txList: FeeInfo[], customTxFeeList: CustomTxFee[]): Promise<GasConsumeDetailsInfo[]> {
        const discountMap = getCustomDiscountMap(customTxFeeList);
        const list: GasConsumeDetailsInfo[] = [];
        for (const item of sortList(txList as any[])) {
            const customFee = discountMap.get(item.chainTxHash || '');
            const gasTokenInfo = nativeToken[item.chainId]?.[NATIVE_TOKEN_ADDRESS];
            const gasFee = `${getTokenAmount(Number(item.gasFee || 0))} ${gasTokenInfo?.symbol || ''}`;
            let feeAddress = NATIVE_TOKEN_ADDRESS;
            if (item.feeToken) {
                try {
                    feeAddress = getAddress(item.feeToken);
                } catch (error) {
                    this.logger.error(`[getGasDetailList] getAddress error item.feeToken is ${item.feeToken}`);
                }
            }
            const feeTokenInfo = nativeToken[item.chainId]?.[feeAddress];
            const feeAmount = `${getTokenAmount(Number(item.feeAmount || 0))} ${feeTokenInfo?.symbol || ''}`;
            let discount = customFee ? `${customFee.discount}` : `${item.discount || ''}`;
            if (discount === '100') {
                discount = 'noDiscount';
            } else if (discount === '0') {
                discount = 'Free';
            } else {
                discount = `${discount}%off`;
            }
            list.push({
                chainId: item.chainId,
                date: item.date,
                gasFee,
                feeAmount,
                submitter: item.submitter,
                address: item.address,
                chainTxHash: item.chainTxHash,
                discount,
                functionAbis: item.functionAbis,
                app: item.app,
            });
        }
        return list;
    }
}
