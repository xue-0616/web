import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { QUEUE_TRANSACTION, TRANSACTION_BTC_STATUS } from '../../common/utils/bull.name';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { BtcTransferVirtualTxResult, Collector, buildRgbppLockArgs, getXudtTypeScript } from '@rgbpp-sdk/ckb';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { TokenEntity } from '../../database/entities/token.entity';
import { BtcAssetsApi } from '@rgbpp-sdk/service';
import { DataSource, NetworkType, bitcoin } from '@rgbpp-sdk/btc';
import { ItemEntity, ItemStatus } from '../../database/entities/item.entity';
import { CKBTransaction } from './dto/buy-items.input.dto';
import Decimal from 'decimal.js';
import { ItemService } from './order/item.service';
import { OrderEntity, OrderStatus } from '../../database/entities/order.entity';
import { Queue } from 'bull';
import { BtcQueueJobData } from '../../common/interface/btc.queue';
import { BtcService } from '../btc/btc.service';
import { TasksService } from './tasks.service';
import { genBtcTransferCkbVirtualTx } from '../../common/utils/ckb.virtual.tx';
import { serializeScript } from '@nervosnetwork/ckb-sdk-utils';
import { StatusName } from '../../common/utils/error.code';
import { isArraysIdentical, psbtValidator, sleep } from '../../common/utils/tools';
import { QueueDelayTime } from '../../common/utils/const.config';

export enum RGBPPTransactionStatus {
    UNKNOWN = 0,
    CONFIRMED = 1,
    PENDING = 2,
    NOT_FOUND = 3,
}

@Injectable()
export class RgbppAssetsService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfig: AppConfigService, private readonly itemService: ItemService, private readonly btcService: BtcService, private readonly tasksService: TasksService, @InjectQueue(QUEUE_TRANSACTION) private readonly queue: Queue) {
        this.logger.setContext(RgbppAssetsService.name);
        this.initSdkService();
    }
    service!: BtcAssetsApi;
    source!: DataSource;
    private collector: any;
    private network: any;
    initSdkService() {
            const networkType = this.appConfig.isTestnet
                ? NetworkType.TESTNET
                : NetworkType.MAINNET;
            this.service = BtcAssetsApi.fromToken(this.appConfig.rgbPPConfig.btcAssetsApiUrl, this.appConfig.rgbPPConfig.btcApiToken, this.appConfig.rgbPPConfig.btcApiOrigin);
            this.source = new DataSource(this.service, networkType);
            this.collector = new Collector({
                ckbNodeUrl: this.appConfig.rgbPPConfig.ckbNodeUrl,
                ckbIndexerUrl: this.appConfig.rgbPPConfig.ckbIndexerUrl,
            });
            this.network = this.appConfig.isTestnet
                ? bitcoin.networks.testnet
                : bitcoin.networks.bitcoin;
        }
    async getCkbVirtualTxResult(rgbppArgs: string[], amount: number, tokenEntity: TokenEntity): Promise<BtcTransferVirtualTxResult> {
            const typeScript = getXudtTypeScript(this.appConfig.isTestnet ? false : true);
            const typeAsset = {
                ...typeScript,
                args: tokenEntity.xudtArgs,
            };
            return await genBtcTransferCkbVirtualTx({
                collector: this.collector,
                rgbppLockArgsList: rgbppArgs,
                xudtTypeBytes: serializeScript(typeAsset),
                transferAmount: BigInt(amount),
                isMainnet: this.appConfig.isTestnet ? false : true,
                noMergeOutputCells: true,
            });
        }
    async getSdkCkbVirtualTxResult(rgbppArgs: string[], amount: number, tokenEntity: TokenEntity): Promise<BtcTransferVirtualTxResult> {
            const typeScript = getXudtTypeScript(this.appConfig.isTestnet ? false : true);
            const typeAsset = {
                ...typeScript,
                args: tokenEntity.xudtArgs,
            };
            this.logger.log(`[getSdkCkbVirtualTxResult]:${JSON.stringify({ typeAsset, rgbppArgs, isMainnet: this.appConfig.isTestnet ? false : true })}`);
            return await genBtcTransferCkbVirtualTx({
                collector: this.collector,
                rgbppLockArgsList: rgbppArgs,
                xudtTypeBytes: serializeScript(typeAsset),
                transferAmount: BigInt(amount),
                isMainnet: this.appConfig.isTestnet ? false : true,
                noMergeOutputCells: true,
            });
        }
    async checkBuyRgbppBtcTransaction(buyerSigPsbt: string, items: ItemEntity[], totalSum: Decimal, tokenEntity: TokenEntity, ckbTx: CKBTransaction, marketFee: string, buyerAddress: string): Promise<{
        buyerPsbt: bitcoin.Psbt;
        ckbVirtualTxResult: BtcTransferVirtualTxResult;
    }> {
            const lockArgsList = items.map((x) => {
                return buildRgbppLockArgs(x.index, x.txHash);
            });
            if (totalSum.toNumber() != Number(ckbTx.transferAmount)) {
                this.logger.error(`ckb tx transferAmount not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
            if (!isArraysIdentical(ckbTx.rgbppLockArgsList, lockArgsList)) {
                this.logger.error(`ckb tx args not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
            const [ckbVirtualTxResult, buyerUtxos] = await Promise.all([
                this.getCkbVirtualTxResult(lockArgsList, totalSum.toNumber(), tokenEntity),
                this.service.getBtcUtxos(buyerAddress),
            ]);
            const buyerPsbt = bitcoin.Psbt.fromHex(buyerSigPsbt, {
                network: this.network,
            });
            const outputs = buyerPsbt.txOutputs;
            const _embedOut1 = bitcoin.payments.embed({
                data: [Buffer.from(ckbVirtualTxResult.commitment, 'hex')],
            }).output as Buffer;
            if (!outputs[0].script.equals(_embedOut1)) {
                this.logger.log(` outputs[0].script ${outputs[0].script.toString('hex')}`);
                this.logger.log(` ckbVirtualTxResult.commitment ${_embedOut1.toString('hex')}`);
                this.logger.error(`btc commitment not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
            if (parseInt(marketFee) >= this.appConfig.rgbPPConfig.minMarketFee) {
                const output = outputs.find((item) => item.address === this.appConfig.rgbPPConfig.receiveFeeAddress);
                if (!output || output.value != parseInt(marketFee)) {
                    this.logger.error(`output not find market_address or output.value !=marketFee`);
                    throw new BadRequestException(StatusName.PsbtException);
                }
            }
            let sellerPsbtList = items.map((x) => bitcoin.Psbt.fromHex(x.psbtSig, { network: this.network }));
            const buyerInputs: any[] = [];
            buyerPsbt.txInputs.forEach((input, buyerPsbtInputIndex) => {
                const i = sellerPsbtList.findIndex((v) => v.txInputs[0].hash.equals(input.hash) &&
                    v.txInputs[0].index === input.index);
                if (i > -1) {
                    const sellerPsbt = sellerPsbtList[i];
                    sellerPsbtList = sellerPsbtList.filter((_, index) => i !== index);
                    const buyerPsbtInputData = buyerPsbt.data.inputs[buyerPsbtInputIndex];
                    if (buyerPsbtInputData.tapKeySig === undefined &&
                        buyerPsbtInputData.partialSig === undefined) {
                        const data = {
                            tapInternalKey: sellerPsbt.data.inputs[0].tapInternalKey,
                            sighashType: sellerPsbt.data.inputs[0].sighashType,
                            tapKeySig: sellerPsbt.data.inputs[0].tapKeySig,
                            partialSig: sellerPsbt.data.inputs[0].partialSig,
                        };
                        if (data.tapInternalKey === undefined ||
                            buyerPsbtInputData.tapInternalKey !== undefined) {
                            delete data.tapInternalKey;
                        }
                        if (data.sighashType === undefined ||
                            buyerPsbtInputData.sighashType !== undefined) {
                            delete data.sighashType;
                        }
                        if (data.tapKeySig === undefined ||
                            buyerPsbtInputData.tapKeySig !== undefined) {
                            delete data.tapKeySig;
                        }
                        if (data.partialSig === undefined ||
                            buyerPsbtInputData.partialSig !== undefined) {
                            delete data.partialSig;
                        }
                        buyerPsbt.updateInput(buyerPsbtInputIndex, data);
                    }
                }
                else {
                    buyerInputs.push(input);
                }
            });
            buyerInputs.forEach((buyerInput) => {
                const buyerInputTxHash = Buffer.from(buyerInput.hash).reverse();
                const utxo = buyerUtxos.find((buyerUtxo) => buyerInputTxHash.equals(Buffer.from(buyerUtxo.txid, 'hex')));
                if (utxo === undefined || !utxo.status.confirmed) {
                    this.logger.error(`buyer utxo expired`);
                    throw new BadRequestException(StatusName.ParameterException);
                }
            });
            if (sellerPsbtList.length > 0) {
                this.logger.error(`not matched tx with seller psbt`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            if (!buyerPsbt.validateSignaturesOfAllInputs(psbtValidator)) {
                this.logger.error(`validate signature failed for psbt`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            buyerPsbt.finalizeAllInputs();
            return { buyerPsbt, ckbVirtualTxResult };
        }
    async checkUnlistRgbppBtcTransaction(buyerSigPsbt: string, items: ItemEntity[], totalSum: Decimal, tokenEntity: TokenEntity, ckbTx: CKBTransaction): Promise<{
        buyerPsbt: bitcoin.Psbt;
        ckbVirtualTxResult: BtcTransferVirtualTxResult;
    }> {
            const lockArgsList = items.map((x) => {
                return buildRgbppLockArgs(x.index, x.txHash);
            });
            if (!isArraysIdentical(ckbTx.rgbppLockArgsList, lockArgsList)) {
                this.logger.error(`ckb tx args not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
            const ckbVirtualTxResult = await this.getSdkCkbVirtualTxResult(lockArgsList, totalSum.toNumber(), tokenEntity);
            const unlistPsbt = bitcoin.Psbt.fromHex(buyerSigPsbt, {
                network: this.network,
            });
            if (!unlistPsbt.validateSignaturesOfAllInputs(psbtValidator)) {
                this.logger.error(`validate signature failed for unlist psbt`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            const outputs = unlistPsbt.txOutputs;
            const _embedOut2 = bitcoin.payments.embed({
                data: [Buffer.from(ckbVirtualTxResult.commitment, 'hex')],
            }).output as Buffer;
            if (!outputs[0].script.equals(_embedOut2)) {
                this.logger.log(` outputs[0].script ${outputs[0].script.toString('hex')}`);
                this.logger.log(` ckbVirtualTxResult.commitment ${_embedOut2.toString('hex')}`);
                this.logger.error(`btc commitment not match`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            unlistPsbt.finalizeAllInputs();
            return { buyerPsbt: unlistPsbt, ckbVirtualTxResult };
        }
    async sendRgbppTransaction(buyerPsbt: bitcoin.Psbt, orderEntity: OrderEntity, ckbVirtualTxResult: BtcTransferVirtualTxResult): Promise<string> {
            const btcTx = buyerPsbt.extractTransaction();
            let btcTxId = '';
            try {
                const { txid } = await this.service.sendBtcTransaction(btcTx.toHex());
                this.logger.log(`[sendBtcTransaction] = ${txid}`);
                btcTxId = txid;
            }
            catch (error) {
                this.logger.error(`[sendBtcTransaction] ${(error as Error)?.stack} buyerPsbt = ${btcTx.toHex()}`);
                orderEntity.status = OrderStatus.btcFailed;
                await this.itemService.updateOrderAndItemsStatus(orderEntity, ItemStatus.Init);
            }
            if (btcTxId) {
                try {
                    await this.sendCkbTransaction(btcTxId, ckbVirtualTxResult);
                }
                catch (error) {
                    this.logger.error(`sendCkbTransaction error ${(error as Error)?.stack}`);
                }
                await this.addUpdateStatusJob({
                    orderId: orderEntity.id,
                    btcTxHash: btcTxId,
                    queryTime: 0,
                });
            }
            return btcTxId;
        }
    async sendCkbTransaction(btcTxId: string, ckbVirtualTxResult: BtcTransferVirtualTxResult): Promise<void> {
            try {
                const state = await this.service.sendRgbppCkbTransaction({
                    btc_txid: btcTxId,
                    ckb_virtual_result: ckbVirtualTxResult,
                });
                this.logger.log(`sendCkbTransaction ${state}`);
            }
            catch (error) {
                this.logger.error(`sendCkbTransaction error ${(error as Error)?.stack}`);
                sleep(1000);
                await this.service.sendRgbppCkbTransaction({
                    btc_txid: btcTxId,
                    ckb_virtual_result: ckbVirtualTxResult,
                });
            }
        }
    async checkAndUpdateRgbppTransactionStatus(jobData: BtcQueueJobData): Promise<{
        status: RGBPPTransactionStatus;
        ckbTxHash: string;
    }> {
            const orderEntity = await this.itemService.findOrderEntity(jobData.orderId);
            if (!orderEntity || orderEntity.status == OrderStatus.ckbComplete) {
                this.logger.log(`orderEntity not find ${jobData.orderId}`);
                return { status: RGBPPTransactionStatus.UNKNOWN, ckbTxHash: '' };
            }
            try {
                const { status, ckbTxHash } = await this.getRgbppTransactionStatus(orderEntity.btcTxHash);
                if (status === RGBPPTransactionStatus.CONFIRMED) {
                    orderEntity.status = OrderStatus.ckbComplete;
                    orderEntity.ckbTxHash = ckbTxHash;
                    await this.itemService.updateOrderAndItemsStatus(orderEntity, ItemStatus.Complete);
                }
                else if (status == RGBPPTransactionStatus.PENDING) {
                    await this.addUpdateStatusJob(jobData);
                }
                else if (status == RGBPPTransactionStatus.NOT_FOUND) {
                    await this.checkBtcTxInputsSpendingStatus(orderEntity);
                }
                else {
                    await this.addUpdateStatusJob(jobData);
                }
                return { status, ckbTxHash };
            }
            catch (err) {
                this.logger.error(`[getBtcTxStatus] ${(err as Error)?.stack}`);
                await this.addUpdateStatusJob(jobData);
            }
            return { status: RGBPPTransactionStatus.UNKNOWN, ckbTxHash: '' };
        }
    async getRgbppTransactionStatus(btcTxHash: string): Promise<{
        status: RGBPPTransactionStatus;
        ckbTxHash: string;
    }> {
            try {
                const { txhash: ckbTxhash } = await this.service.getRgbppTransactionHash(btcTxHash);
                return { status: RGBPPTransactionStatus.CONFIRMED, ckbTxHash: ckbTxhash };
            }
            catch (error) {
                this.logger.log(`[getRgbppTransactionStatus] getRgbppTransactionHash error ${(error as Error)?.stack}`);
            }
            try {
                await this.service.getBtcTransaction(btcTxHash);
            }
            catch (error) {
                this.logger.error(`[getRgbppTransactionStatus] getBtcTransaction ${(error as Error)?.stack}`);
                if ((error as Error).message.indexOf('Transaction not found') > 0) {
                    return { status: RGBPPTransactionStatus.NOT_FOUND, ckbTxHash: '' };
                }
            }
            try {
                const { state, failedReason } = await this.service.getRgbppTransactionState(btcTxHash);
                if (state !== 'failed') {
                    this.logger.log(`[getRgbppTransactionStatus] status is ${state} `);
                    return { status: RGBPPTransactionStatus.PENDING, ckbTxHash: '' };
                }
                else {
                    const { state } = await this.service.retryRgbppCkbTransaction({ btc_txid: btcTxHash });
                    this.logger.log(`[getRgbppTransactionStatus] retryRgbppCkbTransaction is ${state} `);
                }
                this.logger.log(`[getBtcTxStatus] gbpp Btc transaction failed and the state is ${state} failedReason is ${failedReason}`);
            }
            catch (error) {
                this.logger.log(`[getRgbppTransactionStatus] getRgbppTransactionState error ${(error as Error)?.stack}`);
            }
            return { status: RGBPPTransactionStatus.PENDING, ckbTxHash: '' };
        }
    async addUpdateStatusJob(jobData: BtcQueueJobData): Promise<void> {
            jobData.queryTime = jobData.queryTime ? jobData.queryTime + 1 : 1;
            await this.queue.add(TRANSACTION_BTC_STATUS, jobData, {
                delay: QueueDelayTime(jobData.queryTime),
            });
        }
    async checkBtcTxInputsSpendingStatus(orderEntity: OrderEntity): Promise<void> {
            const items = orderEntity.items;
            if (!orderEntity.items && orderEntity.status == OrderStatus.btcFailed) {
                return;
            }
            const buyerPsbt = bitcoin.Psbt.fromHex(orderEntity.btcTx, {
                network: this.network,
            });
            const invalidItemsIds: any[] = [];
            const inputsUtxo = await Promise.all(buyerPsbt.txInputs.map(async (x) => {
                const txid = x.hash.reverse().toString('hex');
                const index = x.index;
                const spendInfo = await this.btcService.getSpendingStatus(txid, x.index);
                const sellerItem = items.find((item) => item.txHash.replace('0x', '') === txid && item.index === index);
                if (spendInfo && spendInfo.spent && sellerItem) {
                    invalidItemsIds.push(sellerItem.id);
                }
                return {
                    isSellerInput: sellerItem ? true : false,
                    spendInfo,
                    utxo: { index, txid },
                };
            }));
            const buyerSpendUtxo = inputsUtxo.find((x) => x.spendInfo.spent && !x.isSellerInput);
            const sellerSpendUtxo = inputsUtxo.find((x) => x.spendInfo.spent && x.isSellerInput);
            this.logger.log(`[checkTxPsbtUtxoInputIsLive] sellerSpendUtxo ${JSON.stringify(sellerSpendUtxo)}, buyerSpendUtxo ${JSON.stringify(buyerSpendUtxo)}`);
            if (buyerSpendUtxo || sellerSpendUtxo) {
                orderEntity.status = OrderStatus.btcFailed;
                await this.itemService.updateOrderAndItemsStatus(orderEntity, ItemStatus.Init, invalidItemsIds);
            }
        }
}
