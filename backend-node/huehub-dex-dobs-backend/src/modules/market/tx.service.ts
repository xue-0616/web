import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { QUEUE_TRANSACTION, TRANSACTION_BTC_STATUS } from '../../common/utils/bull.name';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import { bitcoin } from '@rgbpp-sdk/btc';
import { ItemStatus, OrderEntity, OrderStatus } from '../../database/entities';
import { SporeTransferVirtualTxResult } from '../../common/rgbpp/sport.batch.transfer';
import { BtcAssetsApi } from '@rgbpp-sdk/service';
import { OrdersDbService } from './db.service.ts';
import { BtcQueueJobData, DobsTransactionStatus } from '../../common/interface/btc.queue';
import { Queue } from 'bull';
import { BtcService } from '../btc/btc.service';
import { sleep } from '../../common/utils/tools';
import { QueueDelayTime } from '../../common/utils/const.config';

@Injectable()
export class TransactionService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfigService: AppConfigService, private readonly btcService: BtcService, private readonly ordersDbService: OrdersDbService, @InjectQueue(QUEUE_TRANSACTION) private readonly queue: Queue) {
        this.logger.setContext(TransactionService.name);
        this.network = this.appConfigService.isTestnet
            ? bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;
        this.service = BtcAssetsApi.fromToken(this.appConfigService.rgbPPConfig.btcAssetsApiUrl, this.appConfigService.rgbPPConfig.btcApiToken, this.appConfigService.rgbPPConfig.btcApiOrigin);
    }
    private network: any;
    service: BtcAssetsApi;
    async sendRgbppTransaction(buyerPsbt: bitcoin.Psbt, orderEntity: OrderEntity, ckbVirtualTxResult: SporeTransferVirtualTxResult): Promise<string> {
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
                await this.ordersDbService.updateOrderAndItemsStatus(orderEntity, ItemStatus.Init);
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
    async sendCkbTransaction(btcTxId: string, ckbVirtualTxResult: SporeTransferVirtualTxResult): Promise<void> {
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
    async addUpdateStatusJob(jobData: BtcQueueJobData): Promise<void> {
            jobData.queryTime = jobData.queryTime ? jobData.queryTime + 1 : 1;
            await this.queue.add(TRANSACTION_BTC_STATUS, jobData, {
                delay: QueueDelayTime(jobData.queryTime),
            });
        }
    async checkAndUpdateRgbppTransactionStatus(jobData: BtcQueueJobData): Promise<{
        status: DobsTransactionStatus;
        ckbTxHash: string;
    }> {
            const orderEntity = await this.ordersDbService.findOrderEntity(jobData.orderId);
            if (!orderEntity || orderEntity.status == OrderStatus.ckbComplete) {
                this.logger.log(`orderEntity not find ${jobData.orderId}`);
                return { status: DobsTransactionStatus.UNKNOWN, ckbTxHash: '' };
            }
            try {
                const { status, ckbTxHash } = await this.getRgbppTransactionStatus(orderEntity.btcTxHash);
                if (status === DobsTransactionStatus.CONFIRMED) {
                    orderEntity.status = OrderStatus.ckbComplete;
                    orderEntity.ckbTxHash = ckbTxHash;
                    await this.ordersDbService.updateOrderAndItemsStatus(orderEntity, ItemStatus.Complete);
                }
                else if (status == DobsTransactionStatus.PENDING) {
                    await this.addUpdateStatusJob(jobData);
                }
                else if (status == DobsTransactionStatus.NOT_FOUND) {
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
            return { status: DobsTransactionStatus.UNKNOWN, ckbTxHash: '' };
        }
    async getRgbppTransactionStatus(btcTxHash: string): Promise<{
        status: DobsTransactionStatus;
        ckbTxHash: string;
    }> {
            try {
                const { txhash: ckbTxhash } = await this.service.getRgbppTransactionHash(btcTxHash);
                return { status: DobsTransactionStatus.CONFIRMED, ckbTxHash: ckbTxhash };
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
                    return { status: DobsTransactionStatus.NOT_FOUND, ckbTxHash: '' };
                }
            }
            try {
                const { state, failedReason } = await this.service.getRgbppTransactionState(btcTxHash);
                if (state !== 'failed') {
                    this.logger.log(`[getRgbppTransactionStatus] status is ${state} `);
                    return { status: DobsTransactionStatus.PENDING, ckbTxHash: '' };
                }
                else {
                    const { state } = await this.service.retryRgbppCkbTransaction({
                        btc_txid: btcTxHash,
                    });
                    this.logger.log(`[getRgbppTransactionStatus] retryRgbppCkbTransaction is ${state} `);
                }
                this.logger.log(`[getBtcTxStatus] gbpp Btc transaction failed and the state is ${state} failedReason is ${failedReason}`);
            }
            catch (error) {
                this.logger.log(`[getRgbppTransactionStatus] getRgbppTransactionState error ${(error as Error)?.stack}`);
            }
            return { status: DobsTransactionStatus.PENDING, ckbTxHash: '' };
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
                await this.ordersDbService.updateOrderAndItemsStatus(orderEntity, ItemStatus.Init, invalidItemsIds);
            }
        }
}
