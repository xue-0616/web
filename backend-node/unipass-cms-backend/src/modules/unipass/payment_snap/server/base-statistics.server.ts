import { Injectable } from '@nestjs/common';
import { RelayerService } from '../../../../modules/unipass/relayer/relayer.service';
import { FeeInfo } from '../utils/interface';
import { SnapAppDbService } from './snap-app-db.service';
import { LoggerService } from '../../../../shared/logger/logger.service';
import { GasStatisticsService } from '../../../../modules/unipass/relayer/gas.statistics.service';
import { getAddress } from 'ethers';
import { getGasFee } from '../utils/payment-snap-gas.utils';
import { decodeErc20TransferByData, decodeTransactionData } from '../utils/transaction.utils';

@Injectable()
export class BaseStatisticsService {
    snapAppDbService;
    relayerService;
    gasStatisticsService;
    logger;
    constructor(snapAppDbService: SnapAppDbService, relayerService: RelayerService, gasStatisticsService: GasStatisticsService, logger: LoggerService) {
        this.snapAppDbService = snapAppDbService;
        this.relayerService = relayerService;
        this.gasStatisticsService = gasStatisticsService;
        this.logger = logger;
    }
    async getRelayerTransaction(walletAddress: any, start: any, end: any, details: any, where: any, showPayment: any, app: any): Promise<FeeInfo[]> {
        let list = await this.snapAppDbService.getRelayerTransactionList(walletAddress, start, end, where);
        let data = [];
        for (let item of list) {
            let functionAbis = decodeTransactionData(item.transaction, details);
            let gasFee = getGasFee(item.chainId, item.gasLimit, item.gasPrice, this.logger);
            let feeIncome = '0';
            try {
                if (item.feeToken) {
                    const fee = this.relayerService.paseTransaction(item);
                    feeIncome = fee.feeIncome;
                }
            }
            catch (error) {
                this.logger.error(`[getRelayerTransaction] paseTransaction error:${(error as Error).message},data = ${JSON.stringify(item)}`);
            }
            try {
                item.submitter = getAddress(item.submitter);
            }
            catch (error) {
                this.logger.error(`[getRelayerTransaction] get submitter address error:${(error as Error).message},data = ${item.submitter}`);
            }
            let transfer = [];
            if (showPayment) {
                transfer = decodeErc20TransferByData(item.transaction, item.chainId);
            }
            data.push({
                chainId: item.chainId,
                date: item.date,
                gasFee,
                feeToken: item.feeToken,
                feeAmount: feeIncome,
                submitter: item.submitter,
                address: getAddress(item.walletAddress),
                chainTxHash: `0x${item.chainTxHash}`,
                discount: item.discount,
                functionAbis,
                data: showPayment ? transfer : null,
                app,
            });
        }
        return data;
    }
    async getTokenUsdPrice(cid: any): Promise<number> {
        try {
            let idToken = await this.gasStatisticsService.getPriceConversion([
                Number(cid),
            ]);
            let { quote } = idToken;
            return quote.USD.price;
        }
        catch (error) {
            return 1;
        }
    }
}
