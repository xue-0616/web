import { Injectable } from '@nestjs/common';
import { UserActionPointStatus } from '../entities';
import { getTxSigRawData } from '../../../shared/utils/ap.utils';

@Injectable()
export class ActionPointShowService {
    constructor(actionPointService: any, actionPointTransactionsService: any, logger: any) {
        this.actionPointService = actionPointService;
        this.actionPointTransactionsService = actionPointTransactionsService;
        this.logger = logger;
        logger.setContext(ActionPointShowService.name);
    }
    actionPointService: any;
    actionPointTransactionsService: any;
    logger: any;
    async getActionPointBalance(account: any) {
            var _a, _b, _c;
            const { id, email, provider, address } = account;
            const data = await this.actionPointTransactionsService.findOneActionPointDbInfo(id);
            const result = {
                availActionPoint: (_a = data === null || data === void 0 ? void 0 : data.availActionPoint) !== null && _a !== void 0 ? _a : '0',
                lockActionPoint: (_b = data === null || data === void 0 ? void 0 : data.lockActionPoint) !== null && _b !== void 0 ? _b : '0',
                decimal: (_c = data === null || data === void 0 ? void 0 : data.decimal) !== null && _c !== void 0 ? _c : 0,
            };
            this.logger.log(`[getActionPointBalance] data = ${JSON.stringify(result)}, from ${email}_${provider}, address = ${address}`);
            return result;
        }
    async getActionPointHistory(input: any, account: any) {
            const { limit, page } = input;
            const { id, email, provider, address } = account;
            const data = (await this.actionPointTransactionsService.findHistoryListByWhere({
                accountId: id,
                status: UserActionPointStatus.SUCCESS,
            }, limit, page, ['actionPointDiff', 'changeType', 'changeTime', 'changeMsg']));
            this.logger.log(`[getActionPointHistory] historyList length = ${data.list.length},from ${email}_${provider},address = ${address}`);
            return data;
        }
    async getApTransactionSignature(input: any, account: any) {
            const { email, provider, address, id } = account;
            const { ap, txs, chainId, nonce, timestamp, targetAddress } = input;
            await this.actionPointService.checkIfActionPointValueIsValid(id, ap);
            const rawData = getTxSigRawData(chainId, targetAddress, nonce, ap, txs, timestamp);
            const apSig = await this.actionPointService
                .getAdminWallet()
                .signMessage(rawData);
            this.logger.log(`[getApTransactionSignature] apSig = ${JSON.stringify({
                rawData,
                apSig,
                chainId,
                nonce,
            })} ,from ${email}_${provider},address = ${JSON.stringify({
                targetAddress,
                address,
            })}, `);
            return { apSig };
        }
}
