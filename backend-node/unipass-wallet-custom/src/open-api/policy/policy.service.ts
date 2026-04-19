import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { POLICY_CALLBACK_JOB, POLICY_TRANSACTION_QUEUE } from '../../shared/utils/bull.name';
import decimal_js from 'decimal.js';
import moment from 'moment';
import { NATIVE_TOKEN_ADDRESS, chainErc20Config, getBalancesByMulticall, getSupportChainIdList } from '../utils/erc20.token';
import { arrayify, defaultAbiCoder, getAddress, keccak256, solidityPack } from 'ethers/lib/utils';
import { ConsumptionStatus, PolicyType } from '../../modules/customer/entities';
import { getTransactionList } from '../utils/transaction';
import { digestTxHash } from '@unipasswallet/transactions';
import { StatusName, verifyK1Sign } from '../../shared/utils';
import { utils } from 'ethers';
import { getConsumedGasInfo, getTankPaidGas, getTokenConfig, getUserPaidGas } from '../utils/calculate.gas';

@Injectable()
export class PolicyService {
    constructor(logger: any, customAuthAppInfoDbService: any, customerDbService: any, erc20ToUSDService: any, apiConfigService: any, @InjectQueue(POLICY_TRANSACTION_QUEUE) queue: any) {
        this.logger = logger;
        this.customAuthAppInfoDbService = customAuthAppInfoDbService;
        this.customerDbService = customerDbService;
        this.erc20ToUSDService = erc20ToUSDService;
        this.apiConfigService = apiConfigService;
        this.queue = queue;
        this.logger.setContext(PolicyService.name);
    }
    logger: any;
    customAuthAppInfoDbService: any;
    customerDbService: any;
    erc20ToUSDService: any;
    apiConfigService: any;
    queue: any;
    async gasFeeAdjustment(input: any, appId: any) {
            let adjustment = 100;
            this.logger.log(`[gasFeeAdjustment] appId = ${appId} input = ${JSON.stringify(input)}`);
            let appInfo;
            try {
                appInfo = await this.customAuthAppInfoDbService.getAppInfo({
                    appId,
                });
            }
            catch (_a) {
                this.logger.log(`[gasFeeAdjustment] appInfo not find adjustment = ${adjustment}`);
                return {
                    adjustment,
                };
            }
            if (!appInfo.customerId || appInfo.enableCustomPolicy) {
                this.logger.log(`[gasFeeAdjustment] customerId = ${appInfo.customerId} enableCustomPolicy ${appInfo.enableCustomPolicy} adjustment = ${adjustment} `);
                return {
                    adjustment,
                };
            }
            const { chainId } = input;
            if (getSupportChainIdList().includes(chainId)) {
                const custom = await this.customerDbService.findOne({
                    id: appInfo.customerId,
                });
                if (!custom) {
                    this.logger.log(`[gasFeeAdjustment] custom not find ${appInfo.customerId}  adjustment = ${adjustment}`);
                    return {
                        adjustment,
                    };
                }
                const isGreaterThan = await this.isGreaterThanUSDThreshold(custom.gasTankBalance);
                if (!isGreaterThan) {
                    this.logger.log(`[gasFeeAdjustment] custom.gasTankBalance < -1 USD ${custom.gasTankBalance}  adjustment = ${adjustment}`);
                    return {
                        adjustment,
                    };
                }
            }
            this.logger.log(`[gasFeeAdjustment] adjustment = ${adjustment}`);
            return {
                adjustment,
            };
        }
    async isGreaterThanUSDThreshold(tankBalance: any) {
            const tankPaidToken = this.apiConfigService.appConfig.tankToken;
            const tankTokenChainId = this.apiConfigService.appConfig.tankTokenChainId;
            const cid = (chainErc20Config as any)[tankTokenChainId][getAddress(tankPaidToken)].cid;
            const tankTokenToUsd = new decimal_js((await this.erc20ToUSDService.getTokenUsdByID([`${cid}`]))[cid]);
            const tankToUsd = new decimal_js(tankBalance).mul(tankTokenToUsd).toNumber();
            const isLess = tankToUsd >= -1;
            this.logger.log(`[isGreaterThanUSDThreshold] tankTokenToUsd =${tankTokenToUsd.toNumber()} >= -1 = ${isLess} tankBalance = ${tankBalance}`);
            return isLess;
        }
    async verifyTransaction(input: any, appId: any) {
            const { estimateConsumedFee, chainId } = input;
            this.logger.log(`[verifyTransaction] appId = ${appId} input = ${JSON.stringify(input)}`);
            this.verifyRelayerSig(input, appId);
            const { isNeedNotify, appInfo } = await this.getAppInfoByAppId(appId, input);
            if (!isNeedNotify || !appInfo) {
                this.logger.log(`[verifyTransaction] appInfo not find or isNeedNotify is ${isNeedNotify}`);
                return {
                    isPolicyTransaction: isNeedNotify,
                };
            }
            const customer = await this.customerDbService.findOne({
                id: appInfo.customerId,
            });
            let policyType = PolicyType.NoPolicy;
            if (appInfo.enableCustomPolicy) {
                policyType = PolicyType.CustomPolicy;
                const isVerify = this.verifyGasFreeSig(input, appInfo.customPolicyPublicKey);
                this.logger.log(`[verifyTransaction] verifyGasFreeSig is ${isVerify}`);
                if (!isVerify) {
                    return {
                        isPolicyTransaction: isVerify,
                    };
                }
            }
            else {
            }
            this.logger.log(`[verifyTransaction] policyType =${policyType}`);
            if (policyType === PolicyType.NoPolicy) {
                return {
                    isPolicyTransaction: false,
                };
            }
            const isPolicyTransaction = await this.compareTank(appInfo.enableCustomPolicy, estimateConsumedFee, chainId, customer);
            this.logger.log(`[verifyTransaction] compareTank isPolicyTransaction = ${isPolicyTransaction}`);
            if (isPolicyTransaction) {
                await this.generateGasConsumptionHistory(appId, policyType, input, appInfo.customerId);
            }
            return {
                isPolicyTransaction,
            };
        }
    async getAppInfoByAppId(appId: any, input: any) {
            let isNeedNotify = false;
            let adjustment = 100;
            let appInfo;
            try {
                appInfo = await this.customAuthAppInfoDbService.getAppInfo({ appId });
            }
            catch (_a) {
                this.logger.log('[getAppInfoByAppId] appInfo not find ');
                return { adjustment, isNeedNotify, appInfo };
            }
            if (!appInfo.customerId) {
                this.logger.log('[getAppInfoByAppId] appInfo not bind customer');
                return { adjustment, isNeedNotify, appInfo };
            }
            const { gasFreeSig } = input;
            if (appInfo.enableCustomPolicy && !gasFreeSig) {
                this.logger.log('[getAppInfoByAppId] enableCustomPolicy but not find gasFreeSig');
                return { adjustment, isNeedNotify, appInfo };
            }
            isNeedNotify = true;
            return { isNeedNotify, appInfo };
        }
    verifyRelayerSig(input: any, appId: any) {
            const relayerAddress = this.apiConfigService.getAdminConfig.relayerAddresses;
            const { chainId, relayerSig, userAddress, nonce, feeTransaction, customTransactions, } = input;
            let transactions = getTransactionList(customTransactions, feeTransaction);
            const digestHash = digestTxHash(chainId, userAddress, nonce, transactions);
            const rawData = keccak256(solidityPack(['string', 'bytes'], [appId, digestHash]));
            const isVerify = verifyK1Sign(arrayify(rawData), relayerSig, relayerAddress);
            this.logger.log(`[verifyRelayerSig] isVerify = ${isVerify} relayerAddress=${relayerAddress} rawData =${rawData} digestHash=${digestHash} appId =${appId}`);
            if (!isVerify) {
                throw new BadRequestException(StatusName.RELAYER_SIG_ERROR);
            }
        }
    async verifyAddressBalance(input: any) {
            const { chainId, userAddress, userPaidToken, userPaidFee } = input;
            const multicallAddress = this.apiConfigService.getContractConfig.multicallAddress;
            let nodeNames = this.apiConfigService.getContractConfig.nodeName;
            const rpcUrl = `${this.apiConfigService.getContractConfig.rpcNodeUrl}/${nodeNames[chainId]}`;
            let balance = 0;
            try {
                balance = await getBalancesByMulticall(chainId, userAddress, userPaidToken, multicallAddress, rpcUrl);
            }
            catch (error) {
                this.logger.warn(`[verifyRelayerSig] verifyAddressBalance error ${error}`);
            }
            this.logger.log(`[verifyRelayerSig] verifyAddressBalance userAddress ${userAddress} balance= ${balance}, userPaidFee= ${userPaidFee} `);
            if (balance === 0 || balance < userPaidFee) {
                throw new BadRequestException(StatusName.RELAYER_SIG_ERROR);
            }
        }
    verifyGasFreeSig(input: any, publicKey: any) {
            const { feeTransaction, customTransactions, gasFreeSig, chainId, nonce, expires, userAddress, } = input;
            let isVerify = false;
            if (!expires || !gasFreeSig || !publicKey) {
                this.logger.warn(`[verifyGasFreeSig] !expires || !gasFreeSig || !publicKey is ${!expires || !gasFreeSig || !publicKey}`);
                return isVerify;
            }
            const diff = moment(expires * 1000).diff(moment(), 's');
            if (diff < 0) {
                this.logger.warn(`[verifyGasFreeSig] expires invalid diff now = ${diff}`);
                return isVerify;
            }
            let transactions = getTransactionList(customTransactions, feeTransaction);
            const digestHash = digestTxHash(chainId, userAddress, nonce, transactions);
            const rawData = defaultAbiCoder.encode(['bytes32', 'uint32'], [digestHash, expires]);
            isVerify = verifyK1Sign(arrayify(rawData), gasFreeSig, publicKey);
            this.logger.warn(`[verifyGasFreeSig] isVerify ${isVerify}, publicKey = ${publicKey} digestHash ${digestHash} rawData = ${rawData}`);
            return isVerify;
        }
    async compareTank(enableCustomPolicy: any, estimateConsumedFee: any, chainId: any, customer: any) {
            if (!customer) {
                return false;
            }
            let isGreaterThan = await this.isGreaterThanUSDThreshold(customer.gasTankBalance);
            if (!isGreaterThan) {
                return false;
            }
            if (enableCustomPolicy) {
                return isGreaterThan;
            }
            const token = (chainErc20Config as any)[chainId][NATIVE_TOKEN_ADDRESS];
            const gasBalance = new decimal_js(customer.gasTankBalance)
                .sub(new decimal_js(utils.formatUnits(estimateConsumedFee, token.decimals)))
                .toNumber();
            isGreaterThan = await this.isGreaterThanUSDThreshold(gasBalance);
            return isGreaterThan;
        }
    async generateGasConsumptionHistory(appId: any, policyType: any, input: any, customerId: any, policyId?: any) {
            const { relayerTxHash, customTransactions, userAddress, chainId, nonce, feeTransaction, userPaidTokenDecimal, userPaidTokenUsdPrice, nativeTokenUsdPrice, userPaidToken, userPaidTokenAmount, } = input;
            const { userPaidGas, userPaidFee } = getUserPaidGas(nativeTokenUsdPrice, userPaidTokenAmount, userPaidTokenDecimal, userPaidTokenUsdPrice);
            const consumptionInfo: any = {
                status: ConsumptionStatus.Init,
                policyType,
                relayerTxHash,
                appId,
                chainId,
                userAddress,
                nonce,
                customTransactions: JSON.stringify(customTransactions),
                policyId,
                userPaidGas,
                userPaidFee,
                userPaidToken,
                userPaidTokenUsdPrice,
                nativeTokenUsdPrice,
            };
            if (feeTransaction) {
                consumptionInfo.feeTransaction = JSON.stringify(feeTransaction);
            }
            await this.customerDbService.insertOrUpdateGasConsumptionHistoryDb(consumptionInfo, customerId);
        }
    async consumeGas(input: any, appId: any) {
            let isSuccess = false;
            this.logger.log(`[consumeGas] appId = ${appId} input = ${JSON.stringify(input)}`);
            const { relayerTxHash, chainTxHash, chainId, relayerSig } = input;
            let consumptionHistory = await this.customerDbService.getGasConsumptionHistoryByWhere({
                relayerTxHash,
            });
            if (!consumptionHistory || appId !== consumptionHistory.appId) {
                this.logger.log(`[consumeGas] not find customerInfo ${consumptionHistory} or appId not match `);
                return { success: isSuccess };
            }
            this.verifyRelayerSig({
                customTransactions: consumptionHistory.customTransactions,
                feeTransaction: consumptionHistory.feeTransaction,
                nonce: consumptionHistory.nonce,
                userAddress: consumptionHistory.userAddress,
                chainId,
                relayerSig,
            }, appId);
            const { customer, appInfo } = await this.getAppInfoAndCustom(appId);
            if (!customer || !appInfo) {
                return { success: isSuccess };
            }
            if (consumptionHistory.status !== ConsumptionStatus.Init) {
                this.logger.log(`[consumeGas] relayerTxHash is relayerTxHash success,now status = ${consumptionHistory.status}`);
                return { success: true };
            }
            try {
                consumptionHistory = await this.calculateConsumption(input, consumptionHistory);
            }
            catch (error) {
                this.logger.error(`[calculateConsumption] error ${error}`);
                return { success: false };
            }
            consumptionHistory.chainTxHash = chainTxHash;
            isSuccess =
                await this.customerDbService.insertOrUpdateGasConsumptionHistoryDb(consumptionHistory, appInfo.customerId);
            if (isSuccess) {
                await this.queue.add(POLICY_CALLBACK_JOB, {
                    queryTime: 0,
                    consumptionHistory,
                });
            }
            return { success: isSuccess };
        }
    async getAppInfoAndCustom(appId: any) {
            const appInfo = await this.customAuthAppInfoDbService.getAppInfo({ appId });
            if (!appInfo) {
                this.logger.log(`[reportTransaction] appId ${appId} not find appInfo`);
                return {};
            }
            let customer = await this.customerDbService.findOne({
                id: appInfo.customerId,
            });
            if (!customer) {
                this.logger.log(`[reportTransaction] custom id ${appInfo.customerId} not find custom`);
                return {};
            }
            return { appInfo, customer };
        }
    async calculateConsumption(input: any, customerInfo: any) {
            const { consumedGasUsed, consumedGasPrice, status, errorReason } = input;
            if (!status) {
                customerInfo.status = ConsumptionStatus.OnChainFailed;
                customerInfo.errorReason = errorReason;
                return customerInfo;
            }
            customerInfo.status = ConsumptionStatus.OnChainComplete;
            const tankPaidToken = this.apiConfigService.appConfig.tankToken;
            const tankTokenChainId = this.apiConfigService.appConfig.tankTokenChainId;
            const { nativeTokenConfig, tankTokenConfig } = getTokenConfig(input, tankPaidToken, tankTokenChainId);
            const tokenPrice = await this.erc20ToUSDService.getTokenUsdByID([
                `${tankTokenConfig.cid}`,
            ]);
            const { consumedFee } = getConsumedGasInfo(consumedGasUsed, consumedGasPrice, nativeTokenConfig);
            customerInfo.consumedGasUsed = consumedGasUsed;
            customerInfo.consumedGasPrice = consumedGasPrice;
            customerInfo.consumedFee = consumedFee.toNumber();
            this.logger.log(`[calculateConsumption] consumedFee = ${customerInfo.consumedGasUsed} * ${customerInfo.consumedGasPrice} = ${customerInfo.consumedFee}`);
            const { tankPaidGas, tankPaidFee, tankPaidTokenRate, tankPaidTokenUsdPrice, } = getTankPaidGas(consumedFee, tokenPrice, tankTokenConfig, customerInfo.nativeTokenUsdPrice, customerInfo.userPaidGas);
            customerInfo.tankPaidGas = tankPaidGas.toNumber();
            customerInfo.tankPaidToken = tankPaidToken;
            customerInfo.tankPaidFee = tankPaidFee.toNumber();
            customerInfo.tankPaidTokenUsdPrice = tankPaidTokenUsdPrice.toNumber();
            this.logger.log(`[calculateConsumption] tankPaidGas = ${customerInfo.consumedFee} - ${customerInfo.userPaidGas} = ${customerInfo.tankPaidGas}`);
            this.logger.log(`[calculateConsumption] tankPaidFee = ${customerInfo.tankPaidGas} / (${tankPaidTokenRate}*${customerInfo.tankPaidTokenUsdPrice})= ${customerInfo.tankPaidGas}`);
            return customerInfo;
        }
}
