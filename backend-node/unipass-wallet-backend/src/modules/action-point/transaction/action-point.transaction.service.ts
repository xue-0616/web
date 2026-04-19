import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ACTION_POINT_TRANSACTION_QUEUE, SEND_SYNC_ACTION_POINT_TRANSACTION_STATUS_JOB } from '../../../shared/utils';
import { StatusName, TIME } from '../../../shared/utils/status.msg.code';
import { SigPrefix, getTxSigRawData } from '../../../shared/utils/ap.utils';
import { IApRelayerStatus, IApTransactionStatus, UserActionPointChangeType } from '../entities';
import { getBytes, keccak256, solidityPacked, verifyMessage } from 'ethers';

@Injectable()
export class ActionPointTransactionService {
    constructor(logger: any, accountDbService: any, apiConfigService: any, actionPointService: any, actionPointTransactionsService: any, @InjectQueue(ACTION_POINT_TRANSACTION_QUEUE) queue: any) {
        this.logger = logger;
        this.accountDbService = accountDbService;
        this.apiConfigService = apiConfigService;
        this.actionPointService = actionPointService;
        this.actionPointTransactionsService = actionPointTransactionsService;
        this.queue = queue;
        logger.setContext(ActionPointTransactionService.name);
    }
    logger: any;
    accountDbService: any;
    apiConfigService: any;
    actionPointService: any;
    actionPointTransactionsService: any;
    queue: any;
    getUsdToApConversionRateByAddress({ usd, }: any) {
            const exchangeRate = this.apiConfigService.getApConfig.apToUsdExchangeRate;
            const ap = Math.ceil(usd * exchangeRate).toString();
            const decimal = this.apiConfigService.getApConfig.decimal;
            this.logger.log(`[getUsdToApConversionRateByAddress] ${JSON.stringify({
                ap,
                exchangeRate,
                decimal,
            })}`);
            return { ap, decimal };
        }
    async lockActionPoint(input: any) {
            const { apSig, relayerSig, ap, txs, chainId, nonce, address, relayerTxHash, timestamp, targetAddress, } = input;
            const transactionDBInfo = await this.actionPointTransactionsService.findTransactionDataByWhere({
                relayerTxHash,
            });
            if (transactionDBInfo) {
                this.logger.warn(`[lockActionPoint] relayerAuthAddr ${relayerTxHash} bind data exists`);
                throw new BadRequestException(StatusName.DATA_EXISTS);
            }
            const account = await this.accountDbService.findOneByAddress(address);
            if (!account) {
                this.logger.warn(`[lockActionPoint] account not find by address=${address}`);
                throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
            }
            await this.verifyApTransactionSign({ txs, chainId, targetAddress, nonce }, ap, apSig, timestamp, SigPrefix.LOCK);
            const relayerDbInfo = await this.getRelayerDbInfo(ap, relayerSig, relayerTxHash);
            const isLock = await this.actionPointTransactionsService.LockActionPoint(relayerDbInfo.id, account.id, {
                accountId: account.id,
                actionPointDiff: `-${ap}`,
                changeType: UserActionPointChangeType.TX_SEND,
                changeTime: new Date(),
            }, {
                accountId: account.id,
                actionPoint: ap,
                relayerTxHash,
                transaction: JSON.stringify({ txs, chainId, nonce, targetAddress }),
            });
            this.logger.log(`[lockActionPoint] ${address} start lock ${ap} isLock = ${isLock} `);
            if (isLock) {
                await this.queue.add(SEND_SYNC_ACTION_POINT_TRANSACTION_STATUS_JOB, { queryTime: 1, relayerTxHash }, {
                    delay: TIME.HALF_A_MINUTE * 1000,
                });
            }
            else {
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
        }
    async deductActionPoint(input: any) {
            const { relayerSig, relayerTxHash, chainTxHash } = input;
            const transactionDb = await this.actionPointTransactionsService.findTransactionDataByWhere({
                relayerTxHash,
            });
            if (!transactionDb) {
                this.logger.error(`[deductActionPoint] relayerTxHash=${relayerTxHash} bind db data not find`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            const { actionPoint, status, relayerId } = transactionDb;
            const relayerDb = await this.actionPointTransactionsService.getRelayerDataByWhere({
                id: relayerId,
            });
            if (!relayerDb) {
                this.logger.error(`[deductActionPoint] relayerId=${relayerId}  data not find`);
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            if (status === IApTransactionStatus.COMPLETE) {
                this.logger.log('[deductActionPoint] ap already deducted ');
                return { isDeduct: true };
            }
            const relayerDbInfo = await this.getRelayerDbInfo(actionPoint, relayerSig, relayerTxHash);
            if (!relayerDbInfo || relayerDbInfo.id !== relayerId) {
                this.logger.warn(`[deductActionPoint] relayerDbInfo ${JSON.stringify(relayerDbInfo)} id != relayerId ${relayerId}`);
                throw new BadRequestException(StatusName.AP_SIG_ERROR);
            }
            const isDeduct = await this.actionPointTransactionsService.deductActionPoint(relayerTxHash, chainTxHash);
            this.logger.log(`[deductActionPoint] isDeduct = ${isDeduct}`);
            return { isDeduct };
        }
    async verifyApTransactionSign(input: any, actionPoint: any, apSig: any, timestamp: any, prefix: any) {
            const { txs, chainId, nonce, targetAddress } = input;
            const rawData = getTxSigRawData(chainId, targetAddress, nonce, actionPoint, txs, timestamp);
            this.logger.log(`[verifyApTransactionSign] ${apSig} rawData = ${rawData}`);
            const adminAddress = this.actionPointService
                .getAdminWallet()
                .address.toLowerCase();
            await this.actionPointService.verifySign(apSig, rawData, [adminAddress], 0, `${SigPrefix.PREFIX}${prefix}`);
        }
    getRelayerSigAddress(actionPoint: any, relayerSig: any, relayerTxHash: any) {
            const relayerRawData = keccak256(solidityPacked(['bytes', 'uint64'], [relayerTxHash, actionPoint]));
            const recoveredAddress = verifyMessage(getBytes(relayerRawData), relayerSig);
            this.logger.log(`[getRelayerSigAddress] ${relayerTxHash} relayerRawData = ${relayerRawData}`);
            return recoveredAddress;
        }
    async getRelayerDbInfo(ap: any, relayerSig: any, relayerTxHash: any) {
            const relayerAuthAddr = this.getRelayerSigAddress(ap, relayerSig, relayerTxHash);
            const relayerDbInfo = await this.actionPointTransactionsService.getRelayerDataByWhere({
                relayerAuthAddr,
                status: IApRelayerStatus.OPEN,
            });
            if (!relayerDbInfo) {
                this.logger.warn(`[lockActionPoint] relayerAuthAddr ${relayerAuthAddr} not find`);
                throw new BadRequestException(StatusName.AP_SIG_ERROR);
            }
            return relayerDbInfo;
        }
}
