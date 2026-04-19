import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bull';
import { LAUNCHPAD_BTC_STATUS, QUEUE_LAUNCHPAD_TX } from '../../common/utils/bull.name';
import { AppLoggerService } from '../../common/utils-service/logger.service';
import { MintHistotyDbService } from './db.service';
import { AppConfigService } from '../../common/utils-service/app.config.services';
import { DataSource, NetworkType, bitcoin } from '@rgbpp-sdk/btc';
import Redis from 'ioredis';
import { BtcGasFeeInfo } from '../btc/dto/chain.info.dto';
import { IssueStatus, MintHistoryEntity } from '../../database/entities/mint.history.entity';
import { Queue } from 'bull';
import { LaunchpadStatusJobData } from '../../common/interface/btc.queue';
import { BtcAssetsApi } from '@rgbpp-sdk/service';
import { StatusName } from '../../common/utils/error.code';
import { getMintOpReturn } from '../../common/utils/launch.commitment';
import { psbtValidator } from '../../common/utils/tools';
import { BTC_UTXO_DUST_LIMIT, QueueDelayTime, TIME } from '../../common/utils/const.config';
import { LessThan } from 'typeorm';
import moment from 'moment';

@Injectable()
export class LaunchpadTransactionService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfigService: AppConfigService, private readonly mintHistotyDbService: MintHistotyDbService, @InjectRedis() private readonly redis: Redis, @InjectQueue(QUEUE_LAUNCHPAD_TX) private readonly queue: Queue) {
        this.logger.setContext(LaunchpadTransactionService.name);
        this.network = this.appConfigService.isTestnet
            ? bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;
        this.service = BtcAssetsApi.fromToken(this.appConfigService.rgbPPConfig.btcAssetsApiUrl, this.appConfigService.rgbPPConfig.btcApiToken, this.appConfigService.rgbPPConfig.btcApiOrigin);
        const networkType = this.appConfigService.isTestnet
            ? NetworkType.TESTNET
            : NetworkType.MAINNET;
        this.source = new DataSource(this.service, networkType);
    }
    private network: any;
    private service: any;
    private source: any;
    getUtxoKey(txid: any) {
            return `${this.appConfigService.nodeEnv}:Hue:Hub:Utxo:${txid}{tag}`;
        }
    async verifyMintPsbt(address: string, paymasterAddress: string, mintFee: number, mintBtcTx: string, xudtHash: string, btcGasFeeInfo: BtcGasFeeInfo, paymentAddress: string, paymentAmount: number): Promise<{
        mintPsbt: bitcoin.Psbt;
        txId: string;
    }> {
            let mintPsbt;
            try {
                mintPsbt = bitcoin.Psbt.fromHex(mintBtcTx, {
                    network: this.network,
                });
            }
            catch (error) {
                this.logger.error(`[verifyMintPsbt] error ${error?.stack}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
            await Promise.all(mintPsbt.txInputs.map(async (input) => {
                let txHash = input.hash.reverse().toString('hex');
                let index = input.index;
                await this.verifyAddressUtxo(address, txHash, index);
            }));
            let opReturn = getMintOpReturn(xudtHash, mintPsbt.txInputs[0]);
            const outputs = mintPsbt.txOutputs;
            if (!outputs[0].script.equals(opReturn.script)) {
                this.logger.warn(`[verifyMintPsbt] commitment ${opReturn.script.toString('hex')} not match psbt outputs[0].script ${outputs[0].script.toString('hex')}`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            if (outputs[1].value !== 546) {
                this.logger.warn(`[verifyMintPsbt] outputs[1] value not match 546: value is ${outputs[1].value}`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            if (paymentAddress) {
                const output = outputs.find((item) => item.address === paymentAddress);
                if (!output || output.value != paymentAmount) {
                    this.logger.warn(`[verifyMintPsbt]output not find paymentAddress or output.value !=paymentAmount`);
                    throw new BadRequestException(StatusName.PsbtException);
                }
            }
            const output = outputs.find((item) => item.address === paymasterAddress);
            if (!output || output.value != mintFee) {
                this.logger.warn(`[verifyMintPsbt] output not find paymasterAddress or output.value !=mintFee`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            if (!mintPsbt.validateSignaturesOfAllInputs(psbtValidator)) {
                this.logger.error(`validate signature failed for psbt`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            try {
                mintPsbt.finalizeAllInputs();
            }
            catch (error) {
                this.logger.error(`[verifyMintPsbt] finalizeAllInputs error ${error?.stack}`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            let psbtFeeRate = mintPsbt.getFeeRate();
            if (psbtFeeRate < btcGasFeeInfo.fast) {
                this.logger.warn(`[verifyMintPsbt] psbt feeRate less than current feeRate ${psbtFeeRate},${btcGasFeeInfo.fast}`);
                throw new BadRequestException(StatusName.FeeRateTooLow);
            }
            let txId = '';
            try {
                txId = mintPsbt.extractTransaction().getHash().reverse().toString('hex');
            }
            catch (error) {
                this.logger.error(`[verifyMintPsbt] extractTransaction error ${error?.stack}`);
                throw new BadRequestException(StatusName.PsbtException);
            }
            return { mintPsbt, txId };
        }
    async verifyAddressUtxo(address: string, txHash: string, index: number): Promise<void> {
            let utxos = [];
            let key = this.getUtxoKey(txHash);
            let cacheData = await this.redis.get(key);
            if (cacheData) {
                utxos = JSON.parse(cacheData);
            }
            else {
                try {
                    utxos = await this.service.getBtcUtxos(address, {
                        min_satoshi: BTC_UTXO_DUST_LIMIT,
                    });
                    if (utxos.length > 0) {
                        await this.redis.set(key, JSON.stringify(utxos), 'EX', TIME.TEN_SECOND);
                    }
                }
                catch (error) {
                    this.logger.warn(`[verifyAddressUtxo] getBtcUtxos error ${error?.stack}`);
                }
            }
            let utxo = utxos.find((x) => x.txid === txHash && x.vout == index && x.status.confirmed);
            if (!utxo) {
                this.logger.warn(`[verifyAddressUtxo] utxo not find ${txHash} ${index}`);
                throw new BadRequestException(StatusName.ParameterException);
            }
        }
    async sendMintTransaction(mintPsbt: bitcoin.Psbt, historyEntity: MintHistoryEntity): Promise<MintHistoryEntity> {
            const btcTx = mintPsbt.extractTransaction();
            try {
                const { txid } = await this.service.sendBtcTransaction(btcTx.toHex());
                this.logger.log(`[sendMintTransaction] = ${txid}`);
                historyEntity.status = IssueStatus.MintPending;
                historyEntity.updatedAt = new Date();
                await this.addUpdateStatusJob({
                    mintHistoryId: historyEntity.id,
                    queryTime: 0,
                });
            }
            catch (error) {
                this.logger.error(`[sendMintTransaction] ${error?.stack} buyerPsbt = ${btcTx.toHex()}`);
                historyEntity.status = IssueStatus.MintFailed;
                historyEntity.updatedAt = new Date();
            }
            await this.mintHistotyDbService.updateLaunchpadMintStatus(historyEntity);
            return historyEntity;
        }
    async addUpdateStatusJob(jobData: LaunchpadStatusJobData): Promise<void> {
            jobData.queryTime = jobData.queryTime ? jobData.queryTime + 1 : 1;
            if (jobData.queryTime < 300) {
                await this.queue.add(LAUNCHPAD_BTC_STATUS, jobData, {
                    delay: QueueDelayTime(jobData.queryTime),
                });
            }
            else {
                this.logger.error(`[addUpdateStatusJob] queryTime out of range mintHistoryId:${jobData.mintHistoryId}`);
            }
        }
    async updateMintTxStatus(jobData: LaunchpadStatusJobData): Promise<void> {
            let { mintHistoryId } = jobData;
            let historyEntity = await this.mintHistotyDbService.findOne({ id: mintHistoryId }, { launchpadRound: true });
            if (!historyEntity || !historyEntity.launchpadRound) {
                this.logger.warn(`[updateMintTxStatus] jobData not find or launchpadRound  not find`);
                return;
            }
            if (historyEntity.status === IssueStatus.MintComplete) {
                return;
            }
            try {
                let transaction = await this.service.getBtcTransaction(historyEntity.btcTxHash.replace('0x', ''));
                if (transaction.status.confirmed) {
                    historyEntity.status = IssueStatus.MintComplete;
                    historyEntity.updatedAt = new Date();
                    await this.mintHistotyDbService.updateLaunchpadMintStatus(historyEntity);
                }
                else {
                    await this.addUpdateStatusJob(jobData);
                }
            }
            catch (error) {
                this.logger.warn(`[updateMintTxStatus] error ${error?.stack}`);
                if (error.message.indexOf('Transaction not found') > 0) {
                    await this.resendMintTransaction(jobData);
                }
                else {
                    await this.addUpdateStatusJob(jobData);
                }
            }
        }
    async resendMintTransaction(jobData: LaunchpadStatusJobData): Promise<void> {
            let { mintHistoryId } = jobData;
            let historyEntity = await this.mintHistotyDbService.findOne({ id: mintHistoryId }, { launchpadRound: true });
            const mintPsbt = bitcoin.Psbt.fromHex(historyEntity.btcTx.replace('0x', ''), {
                network: this.network,
            });
            try {
                let transaction = await this.service.getBtcTransaction(historyEntity.btcTxHash.replace('0x', ''));
                if (transaction.status.confirmed) {
                    historyEntity.status = IssueStatus.MintComplete;
                }
                else {
                    historyEntity.status = IssueStatus.MintPending;
                    await this.addUpdateStatusJob(jobData);
                }
                historyEntity.updatedAt = new Date();
                await this.mintHistotyDbService.updateLaunchpadMintStatus(historyEntity);
            }
            catch (error) {
                this.logger.warn(`[resendMintTransaction] error ${error?.stack}`);
                if (error.message.indexOf('Transaction not found') > 0) {
                    await this.sendMintTransaction(mintPsbt, historyEntity);
                }
                else {
                    await this.addUpdateStatusJob(jobData);
                }
            }
        }
    async queryInitMintTransaction(): Promise<void> {
            let oneMminutesAgo = moment().subtract(1, 'minutes');
            let histories = await this.mintHistotyDbService.find({
                status: IssueStatus.MintInit,
                createdAt: LessThan(oneMminutesAgo.toDate()),
            });
            await Promise.all(histories.map((history) => this.resendMintTransaction({ mintHistoryId: history.id })));
        }
}
