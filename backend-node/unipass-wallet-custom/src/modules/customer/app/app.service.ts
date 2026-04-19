import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { CALL_BACK_DELAY_TIME, POLICY_CALLBACK_JOB, POLICY_TRANSACTION_QUEUE } from '../../../shared/utils/bull.name';
import decimal_js from 'decimal.js';
import moment from 'moment';
import { v5 } from 'uuid';
import { ConsumptionStatus } from '../entities';
import { NATIVE_TOKEN_ADDRESS, chainErc20Config } from '../../../open-api/utils/erc20.token';
import { getTokenRate } from '../../../open-api/utils/calculate.gas';
import { Wallet } from 'ethers';

@Injectable()
export class AppService {
    constructor(customAuthAppInfoDbService: any, logger: any, apiConfigService: any, upHttpService: any, erc20ToUSDService: any, @InjectQueue(POLICY_TRANSACTION_QUEUE) queue: any) {
        this.customAuthAppInfoDbService = customAuthAppInfoDbService;
        this.logger = logger;
        this.apiConfigService = apiConfigService;
        this.upHttpService = upHttpService;
        this.erc20ToUSDService = erc20ToUSDService;
        this.queue = queue;
        this.logger.setContext(AppService.name);
    }
    customAuthAppInfoDbService: any;
    logger: any;
    apiConfigService: any;
    upHttpService: any;
    erc20ToUSDService: any;
    queue: any;
    async insertOrUpdate(input: any, custom: any) {
            const { appName: inputAppNam, enableCustomPolicy, customPolicyPublicKey, callbackUrl, } = input;
            let { appId: inputAppId } = input;
            inputAppId = inputAppId
                ? inputAppId
                : v5(`${inputAppNam}_${moment().unix()}`, v5.DNS).replace(new RegExp('-', 'g'), '');
            this.logger.log(`custom = ${custom.id} appId = ${inputAppId}`);
            await this.customAuthAppInfoDbService.insertToOrUpdateToBAppInfo({
                appId: inputAppId,
                appName: inputAppNam,
                customerId: custom.id,
                enableCustomPolicy,
                customPolicyPublicKey,
                callbackUrl,
            });
            const appInfo = await this.customAuthAppInfoDbService.getAppInfo({
                appId: inputAppId,
            });
            return {
                appId: appInfo.appId,
                appName: appInfo.appName,
                customerId: appInfo.customerId,
                enableCustomPolicy: appInfo.enableCustomPolicy,
                customPolicyPublicKey: appInfo.customPolicyPublicKey,
                callbackUrl: appInfo.callbackUrl,
                unipassCallbackAuth: appInfo.unipassCallbackAuth,
            };
        }
    async isSuccessSendCallback(customerInfo: any, callbackUrl: any, queryTime: any = 0, rawData: any, authSig: any) {
            if (!callbackUrl) {
                const appInfo = await this.customAuthAppInfoDbService.getAppInfo({
                    appId: customerInfo.appId,
                });
                callbackUrl = appInfo.callbackUrl;
                if (!callbackUrl) {
                    this.logger.warn('sendCallback appInfo not set callback url');
                    return false;
                }
            }
            this.logger.log(`sendCallback callbackUrl = ${callbackUrl}`);
            if (!rawData || !authSig) {
                const data = await this.getCallbackAuthSig(customerInfo);
                rawData = data.rawData;
                authSig = data.authSig;
            }
            this.logger.log(`[sendCallback] rawData = ${rawData} authSig =${authSig} queryTime = ${queryTime}`);
            const res = await this.upHttpService.httpPost(callbackUrl, { rawData, authSig }, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            this.logger.log(`[callback_ret] ${res ? JSON.stringify(res) : res}`);
            if ((!res || res.statusCode !== 200) && queryTime < 7) {
                await this.queue.add(POLICY_CALLBACK_JOB, { queryTime, customerInfo, callbackUrl, rawData, authSig }, {
                    delay: CALL_BACK_DELAY_TIME[queryTime],
                });
                return false;
            }
            return res.data.success;
        }
    async getCallbackAuthSig(customerInfo: any) {
            const { chainTxHash, appId, chainId, customTransactions, feeTransaction, relayerTxHash, consumedFee, tankPaidGas, userAddress, tankPaidTokenUsdPrice, nativeTokenUsdPrice, userPaidTokenUsdPrice, userPaidFee, nonce, status, errorReason, consumedGasUsed: gasUsed, consumedGasPrice: gasPrice, } = customerInfo;
            let costUsd = 0;
            let userFeeUsd = 0;
            if (status === ConsumptionStatus.OnChainComplete) {
                const token = (chainErc20Config as any)[chainId][NATIVE_TOKEN_ADDRESS];
                const tokenUSD = (await this.erc20ToUSDService.getTokenUsdByID([`${token.cid}`]))[token.cid];
                costUsd = Number(new decimal_js(tankPaidGas)
                    .mul(new decimal_js(tokenUSD))
                    .toFixed(4));
                if (userPaidFee && userPaidTokenUsdPrice) {
                    userFeeUsd = Number(new decimal_js(userPaidFee)
                        .mul(new decimal_js(userPaidTokenUsdPrice))
                        .toFixed(4));
                }
            }
            const rate = getTokenRate(nativeTokenUsdPrice, tankPaidTokenUsdPrice);
            const params = {
                appId,
                chainId,
                chainTxHash: chainTxHash,
                consumedFee: Number(consumedFee),
                costUsd,
                userFeeUsd,
                relayerTxHash,
                rate: rate.toNumber(),
                customTransactions: customTransactions,
                feeTransaction: feeTransaction
                    ? feeTransaction
                    : undefined,
                userAddress,
                nonce,
                status,
                errorReason,
                gasUsed,
                gasPrice,
            };
            const rawData = JSON.stringify(params);
            const wallet = new Wallet(this.apiConfigService.appConfig.callbackSigPrivateKey);
            const authSig = await wallet.signMessage(rawData);
            this.logger.log(`[sendCallback] rawData = ${rawData} authSig = ${authSig}, address = ${wallet.address} `);
            return { rawData, authSig };
        }
}
