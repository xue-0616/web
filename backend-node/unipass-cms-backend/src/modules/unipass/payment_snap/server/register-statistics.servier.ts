import { Injectable } from '@nestjs/common';
import { IStatisticsRegisterDto } from '../../dto/app_sanp.dto';
import { SnapAppDbService } from './snap-app-db.service';
import { PaymentAccount, SnapPaymentRegisterInfo } from '../utils/interface';
import { getAllDailyRegisterList, getPaymentRegisterInfo } from '../utils/register-statistics.utils';
import { initTime } from '../utils/input.utils';

type StatisticsResponse<T> = {
    list: T[];
    pagination: {
        total: number;
        size: number;
        page: number;
    };
};

@Injectable()
export class RegisterStatisticsService {
    constructor(private readonly snapAppDbService: SnapAppDbService) {}

    async registerStatistics(dto: IStatisticsRegisterDto): Promise<StatisticsResponse<SnapPaymentRegisterInfo>> {
        let { start, end, app } = dto;
        [start, end] = initTime(start, end);

        let paymentList: PaymentAccount[] = [];
        let snapList: PaymentAccount[] = [];

        if (!app) {
            [paymentList, snapList] = await Promise.all([
                this.snapAppDbService.getPaymentRegisterList(start, end),
                this.snapAppDbService.getSnapRegisterList(start, end),
            ]);
        } else if (app === 'Snap') {
            snapList = await this.snapAppDbService.getSnapRegisterList(start, end);
        } else if (app === 'App') {
            paymentList = await this.snapAppDbService.getPaymentRegisterList(start, end);
        }

        const [snapDailyList, paymentDailyList] = await Promise.all([
            this.getPaymentDetails(snapList, 'Snap'),
            this.getPaymentDetails(paymentList, 'App'),
        ]);

        const list = getAllDailyRegisterList(snapDailyList.concat(paymentDailyList), start, end);
        return {
            list,
            pagination: {
                total: list.length,
                size: list.length,
                page: 1,
            },
        };
    }

    async getPaymentDetails(list: PaymentAccount[], app: string): Promise<SnapPaymentRegisterInfo[]> {
        const dailyAddress = getPaymentRegisterInfo(list, app);
        const dailyList: SnapPaymentRegisterInfo[] = [];
        for (const [, registerInfo] of dailyAddress) {
            const { all, bsc, arb, polygon } = await this.snapAppDbService.getRelayerAccountCount(registerInfo.address || []);
            registerInfo.deployed = all;
            registerInfo.bnbCount = bsc;
            registerInfo.polygonCount = polygon;
            registerInfo.arbCount = arb;
            registerInfo.notDeployed = registerInfo.totalRegister - all;
            delete registerInfo.address;
            dailyList.push(registerInfo);
        }
        return dailyList;
    }
}
