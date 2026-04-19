import { BadRequestException, Injectable } from '@nestjs/common';
import { SIG_PREFIX, StatusName } from '../../../shared/utils';
// ethers v6: BigNumber removed — use native BigInt
import { BigIntValue } from '../../../shared/utils/ap.utils';
import { IApTransactionStatus, UserActionPointChangeType, UserActionPointStatus } from '../entities';
import { getBytes, keccak256, solidityPacked } from 'ethers';
import { UnlockStatus } from '../dto';

@Injectable()
export class ActionPointIssueService {
    constructor(logger: any, accountDbService: any, apiConfigService: any, actionPointService: any, actionPointTransactionsService: any) {
        this.logger = logger;
        this.accountDbService = accountDbService;
        this.apiConfigService = apiConfigService;
        this.actionPointService = actionPointService;
        this.actionPointTransactionsService = actionPointTransactionsService;
        logger.setContext(ActionPointIssueService.name);
    }
    logger: any;
    accountDbService: any;
    apiConfigService: any;
    actionPointService: any;
    actionPointTransactionsService: any;
    async addressActionPoint(input: any) {
            const { apIssueList, adminSig, message, timestamp } = input;
            for (const apIssue of apIssueList) {
                if (!apIssue.address || !apIssue.ap) {
                    throw new BadRequestException(StatusName.UNPROCESSABLE_ENTITY);
                }
            }
            const rawData = `${SIG_PREFIX.AP_ISSUE}${timestamp}:${JSON.stringify(apIssueList)}`;
            const adminAddress = this.apiConfigService.getApConfig.adminAddresses;
            await this.actionPointService.verifySign(adminSig, rawData, adminAddress, timestamp);
            const apInfoList = [];
            for (const item of apIssueList) {
                const apInfo = await this.distributeActionPointByAddress(item, message);
                apInfoList.push(apInfo);
            }
            return apInfoList;
        }
    async distributeActionPointByAddress(apIssue: any, message: any) {
            const { address, ap } = apIssue;
            if (BigInt(ap)=== BigInt(BigIntValue.zero) ||
                BigInt(ap) > BigInt(BigIntValue.maxValue) ||
                BigInt(ap) < BigInt(BigIntValue.minValue)) {
                this.logger.warn(`[distributeActionPointByAddress] ap length error ${JSON.stringify(apIssue)}`);
                return undefined;
            }
            const accountId = await this.accountDbService.getAccountIdByAddress(address);
            const apDbInfo = await this.actionPointTransactionsService.distributeActionPoint({
                accountId,
                actionPointDiff: ap,
                changeType: UserActionPointChangeType.ADMIN_ADD,
                changeMsg: message,
                changeTime: new Date(),
                status: UserActionPointStatus.SUCCESS,
            }, {
                accountId,
                availActionPoint: ap,
                decimal: this.apiConfigService.getApConfig.decimal,
            });
            if (!apDbInfo) {
                return;
            }
            const { availActionPoint, discount, lockActionPoint, decimal } = apDbInfo;
            const apInfo = {
                availActionPoint,
                discount,
                decimal,
                lockActionPoint,
                address,
            };
            this.logger.log(`[distributeActionPointByAddress] admin add ap ${JSON.stringify(apInfo)}}`);
            return apInfo;
        }
    async getActionPointBalance(input: any) {
            const { addresses, adminSig, timestamp } = input;
            const byteArrays = addresses.map((address: any) => getBytes(address));
            const rawData = keccak256(solidityPacked(['bytes[]', 'uint32'], [byteArrays, timestamp]));
            const adminAddress = this.apiConfigService.getApConfig.adminAddresses;
            await this.actionPointService.verifySign(adminSig, rawData, adminAddress, timestamp);
            const addressList = addresses.filter((value: any, index: any, self: any) => self.indexOf(value) === index);
            const apInfoList = await Promise.all(addressList.map(async (address: any) => {
                const apInfo = await this.getAccountApInfo(address);
                return apInfo;
            }));
            return apInfoList;
        }
    async getAccountApInfo(address: any) {
            const accountId = await this.accountDbService.getAccountIdByAddress(address);
            const apInfo = (await this.actionPointTransactionsService.findOneActionPointDbInfo(accountId));
            apInfo.address = address;
            return apInfo;
        }
    async initRelayerConfig(input: any) {
            const { list, timestamp, adminSig } = input;
            const rawData = keccak256(solidityPacked(['string', 'uint32'], [JSON.stringify(list), timestamp]));
            const adminAddress = this.apiConfigService.getApConfig.adminAddresses;
            await this.actionPointService.verifySign(adminSig, rawData, adminAddress, timestamp);
            for (const item of list) {
                const { address: relayerAuthAddr, relayerUrl } = item;
                await this.actionPointTransactionsService.insertDataToApRelayerDB(relayerAuthAddr, relayerUrl);
            }
        }
    async unlockActionPoint(input: any) {
            const { adminSig, status, historyId, chainTxHash, timestamp } = input;
            const rawData = keccak256(solidityPacked(['uint32', 'string', 'uint32'], [historyId, status, timestamp]));
            const adminAddress = this.apiConfigService.getApConfig.adminAddresses;
            await this.actionPointService.verifySign(adminSig, rawData, adminAddress, timestamp);
            const transactionDb = await this.actionPointTransactionsService.findTransactionDataByWhere({
                historyId,
            });
            if (!transactionDb) {
                this.logger.log('[unlockActionPoint] transactionDb not find');
                throw new BadRequestException(StatusName.DATA_NOT_EXISTS);
            }
            if (transactionDb.status !== IApTransactionStatus.PENDING) {
                this.logger.log(`[unlockActionPoint] transactionDb status not in pending ${IApTransactionStatus.PENDING}`);
                return;
            }
            const { relayerTxHash } = transactionDb;
            await (status === UnlockStatus.SUCCESS
                ? this.actionPointTransactionsService.deductActionPoint(relayerTxHash, chainTxHash)
                : this.actionPointTransactionsService.reversalDeductActionPoint(relayerTxHash));
        }
}
