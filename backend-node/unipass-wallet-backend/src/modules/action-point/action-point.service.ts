import { BadRequestException, Injectable } from '@nestjs/common';
import moment from 'moment';
import { Wallet } from 'ethers';
import { StatusName } from '../../shared/utils';
import { verifyMessage } from 'ethers';

@Injectable()
export class ActionPointService {
    constructor(logger: any, redisService: any, apiConfigService: any, actionPointTransactionsService: any) {
        this.logger = logger;
        this.redisService = redisService;
        this.apiConfigService = apiConfigService;
        this.actionPointTransactionsService = actionPointTransactionsService;
        logger.setContext(ActionPointService.name);
        this.wallet = new Wallet(this.apiConfigService.getApConfig.apTxPrivateKey);
    }
    logger: any;
    redisService: any;
    apiConfigService: any;
    actionPointTransactionsService: any;
    wallet: any;
    getAdminWallet() {
            return this.wallet;
        }
    async verifySign(adminSig: any, rawData: any, adminAddress: any, timestamp: any, Prefix: any) {
            if (timestamp) {
                const diff = moment().diff(moment(timestamp * 1000), 's');
                if (diff > 60) {
                    this.logger.warn(`[verifySign] timestamp ${timestamp} timeout now = ${moment().unix()} diff = ${diff}`);
                    throw new BadRequestException(StatusName.AP_SIG_ERROR);
                }
            }
            const key = Prefix ? `${Prefix}:${adminSig}` : adminSig;
            const signInfo = await this.redisService.getCacheData(key);
            if (signInfo) {
                this.logger.warn('[verifySign] signature is used');
                throw new BadRequestException(StatusName.AP_SIG_ERROR);
            }
            try {
                const recoveredAddress = verifyMessage(rawData, adminSig);
                const isVerified = adminAddress.includes(recoveredAddress.toLowerCase());
                this.logger.log(`[verifySign] Prefix = ${Prefix}; adminSig=  ${adminSig}  adminAddress=${adminAddress},sigAddress = ${recoveredAddress.toLowerCase()} isVerified = ${isVerified}`);
                if (!isVerified) {
                    throw new BadRequestException(StatusName.AP_SIG_ERROR);
                }
            }
            catch (_a) {
                throw new BadRequestException(StatusName.AP_SIG_ERROR);
            }
        }
    getTransactions(txs: any) {
            let transactions = [];
            try {
                transactions = txs.map((tx: any) => {
                    const transaction = {
                        _isUnipassWalletTransaction: true,
                        callType: tx.callType,
                        data: tx.data,
                        revertOnError: tx.revertOnError,
                        gasLimit: BigInt(tx.gasLimit),
                        target: tx.target,
                        value: BigInt(tx.value),
                    };
                    return transaction;
                });
            }
            catch (error) {
                this.logger.warn(`[getActionPointHistory] transactions init error ${error}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            if (transactions.length === 0) {
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            return transactions;
        }
    async checkIfActionPointValueIsValid(accountId: any, ap: any) {
            const apInfo = await this.actionPointTransactionsService.findActionPointByAccountId(accountId);
            this.actionPointTransactionsService.checkActionPointValueIsValid(ap, apInfo);
            return apInfo;
        }
}
