import { Injectable } from '@nestjs/common';
import { IStatisticsRegisterDto } from '../../dto/app_sanp.dto';
import { CustomTxFee, ParsePayment } from '../utils/interface';
import { SnapAppDbService } from './snap-app-db.service';
import { BaseStatisticsService } from './base-statistics.server';
import { getAllBatchPaymentList, getAllPaymentList, getAppBatchPaymentTableInfo, getAppPaymentTableInfo, getPaymentGasTableInfo, getSnapBatchPaymentTableInfo } from '../utils/payment-tx.utils';
import { getCustomDiscountMap } from '../utils/payment-snap-gas.utils';
import { initTime } from '../utils/input.utils';

type StatisticsResponse<T> = {
    list: T[];
    pagination: { total: number; size: number; page: number };
};

@Injectable()
export class PaymentTxStatisticsService {
    constructor(
        private readonly snapAppDbService: SnapAppDbService,
        private readonly baseStatisticsService: BaseStatisticsService,
    ) {}

    async getPaymentList(dto: IStatisticsRegisterDto): Promise<StatisticsResponse<any>> {
        let { start, end } = dto;
        [start, end] = initTime(start, end);
        const snapAddress = await this.snapAppDbService.getSnapAddress();
        const [snapDetailsList, paymentDetailList, usdcPrice, usdtPrice] = await Promise.all([
            this.baseStatisticsService.getRelayerTransaction(snapAddress, start, end, undefined, undefined, true, undefined),
            this.snapAppDbService.getPaymentTx(start, end),
            this.baseStatisticsService.getTokenUsdPrice(825),
            this.baseStatisticsService.getTokenUsdPrice(3408),
        ]);
        const tx = snapDetailsList.map((details: any) => details.chainTxHash.replace('0x', ''));
        const customTxFeeList = await this.snapAppDbService.getCustomTxFeeList(tx, start, end);
        const discountMap = getCustomDiscountMap(customTxFeeList);
        const { tableList: snapList, allUser: snapAllUser } = this.getSnapPaymentInfo(snapDetailsList, 'Snap', discountMap, usdcPrice, usdtPrice);
        const { tableList: paymentList, allUser: paymentAllUser } = this.getAppPaymentInfo(paymentDetailList, usdcPrice, usdtPrice);
        const list = getAllPaymentList(snapList.concat(paymentList), start, end, snapAllUser + paymentAllUser);
        return { list, pagination: { total: list.length, size: list.length, page: 1 } };
    }

    getSnapPaymentInfo(list: any[], app: string, discountMap: Map<string, CustomTxFee>, usdcPrice: number, usdtPrice: number) {
        const paymentMap = new Map();
        const bscUserSet = new Map();
        const dayUserSet = new Map();
        const allUserSet = new Set();
        const polygonUserSet = new Map();
        const arbUserSet = new Map();
        for (const item of list) {
            const custom = discountMap.get(item.chainTxHash);
            const info = getPaymentGasTableInfo(item, app, dayUserSet, bscUserSet, polygonUserSet, arbUserSet, usdcPrice, usdtPrice, paymentMap.get(item.date), custom);
            paymentMap.set(item.date, info);
            allUserSet.add(item.address);
        }
        return { tableList: Array.from(paymentMap.values()), allUser: allUserSet.size };
    }

    getAppPaymentInfo(list: ParsePayment[], usdcPrice: number, usdtPrice: number) {
        const paymentMap = new Map();
        const bscUserSet = new Map();
        const polygonUserSet = new Map();
        const arbUserSet = new Map();
        const dayUserSet = new Map();
        const allUserSet = new Set();
        for (const item of list) {
            const info = getAppPaymentTableInfo(item, 'App', dayUserSet, bscUserSet, polygonUserSet, arbUserSet, usdcPrice, usdtPrice, paymentMap.get(item.date));
            allUserSet.add(item.address);
            paymentMap.set(item.date, info);
        }
        return { tableList: Array.from(paymentMap.values()), allUser: allUserSet.size };
    }

    async getBatchPaymentList(dto: IStatisticsRegisterDto): Promise<StatisticsResponse<any>> {
        let { start, end } = dto;
        [start, end] = initTime(start, end);
        const snapAddress = await this.snapAppDbService.getSnapAddress();
        const [snapDetailsList, paymentList] = await Promise.all([
            this.baseStatisticsService.getRelayerTransaction(snapAddress, start, end, undefined, undefined, true, undefined),
            this.snapAppDbService.getPaymentTx(start, end),
        ]);
        const tx = snapDetailsList.map((details: any) => details.chainTxHash.replace('0x', ''));
        const customTxFeeList = await this.snapAppDbService.getCustomTxFeeList(tx, start, end);
        const discountMap = getCustomDiscountMap(customTxFeeList);
        const { tableList: snapList, allUserCount: snapAllUserCount } = this.getSnapBatchPaymentInfo(snapDetailsList, discountMap);
        const { tableList: batchPaymentList, allUserCount: paymentAllUserCount } = this.getAppBatchPaymentInfo(paymentList);
        const list = getAllBatchPaymentList(snapList.concat(batchPaymentList), start, end, snapAllUserCount + paymentAllUserCount);
        return { list, pagination: { total: list.length, size: list.length, page: 1 } };
    }

    getSnapBatchPaymentInfo(list: any[], discountMap: Map<string, CustomTxFee>) {
        const paymentMap = new Map();
        const bscUserSet = new Map();
        const polygonUserSet = new Map();
        const arbUserSet = new Map();
        const allUser = new Set();
        const allUserSet = new Map();
        for (const item of list) {
            if (!item.data) {
                continue;
            }
            const custom = discountMap.get(item.chainTxHash);
            const discount = custom ? custom.discount : Number(item.discount);
            const fee = discount === 0 ? 1 : 0;
            if (!fee) {
                item.data.pop();
            }
            if (item.data.length < 2) {
                continue;
            }
            allUser.add(item.address);
            const info = getSnapBatchPaymentTableInfo(item, 'Snap', bscUserSet, polygonUserSet, arbUserSet, allUserSet, paymentMap.get(item.date));
            paymentMap.set(item.date, info);
        }
        return { tableList: Array.from(paymentMap.values()), allUserCount: allUser.size };
    }

    getAppBatchPaymentInfo(list: ParsePayment[]) {
        const paymentMap = new Map();
        const bscUserSet = new Map();
        const polygonUserSet = new Map();
        const arbUserSet = new Map();
        const allUserSet = new Map();
        const allUser = new Set();
        for (const item of list) {
            if (item.output.length < 2) {
                continue;
            }
            const info = getAppBatchPaymentTableInfo(item, bscUserSet, polygonUserSet, arbUserSet, allUserSet, paymentMap.get(item.date));
            paymentMap.set(item.date, info);
            allUser.add(item.address);
        }
        return { tableList: Array.from(paymentMap.values()), allUserCount: allUser.size };
    }
}
