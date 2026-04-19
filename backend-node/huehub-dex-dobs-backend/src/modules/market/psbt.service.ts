import { BadRequestException, Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../common/utils.service/logger.service';
import Decimal from 'decimal.js';
import { AppConfigService } from '../../common/utils.service/app.config.services';
import { bitcoin } from '@rgbpp-sdk/btc';
import { ItemEntity } from '../../database/entities';
import { BtcAssetsService } from '../btc/btc.assets.service';
import { SporeTransferVirtualTxResult, genBatchTransferSporeCkbVirtualTx } from '../../common/rgbpp/sport.batch.transfer';
import { CKBTransaction } from '../collection/dto/buy.tems.input.dto';
import { BtcAssetsApi } from '@rgbpp-sdk/service';
import { Collector, append0x, buildRgbppLockArgs, deduplicateList, getSporeTypeScript } from '@rgbpp-sdk/ckb';
import { StatusName } from '../../common/utils/error.code';
import { isArraysIdentical, psbtValidator } from '../../common/utils/tools';
import { BTC_UTXO_DUST_LIMIT } from '../../common/utils/const.config';
import { serializeScript } from '@nervosnetwork/ckb-sdk-utils';

@Injectable()
export class PsbtService {
    constructor(private readonly logger: AppLoggerService, private readonly appConfigService: AppConfigService, private readonly btcAssetsService: BtcAssetsService) {
        this.logger.setContext(PsbtService.name);
        this.network = this.appConfigService.isTestnet
            ? bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;
        this.isMainnet = !this.appConfigService.isTestnet;
        this.collector = new Collector({
            ckbNodeUrl: this.appConfigService.rgbPPConfig.ckbNodeUrl,
            ckbIndexerUrl: this.appConfigService.rgbPPConfig.ckbIndexerUrl,
        });
        this.service = BtcAssetsApi.fromToken(this.appConfigService.rgbPPConfig.btcAssetsApiUrl, this.appConfigService.rgbPPConfig.btcApiToken, this.appConfigService.rgbPPConfig.btcApiOrigin);
    }
    private network: any;
    private isMainnet: any;
    private collector: any;
    service: BtcAssetsApi;
    verifyListPsbt(sigPsbt: string, address: string, price: Decimal, txHash: string, index: number): string {
            const psbt = bitcoin.Psbt.fromHex(sigPsbt, { network: this.network });
            if (psbt.txInputs.length !== 1 ||
                psbt.data.inputs[0].sighashType !==
                    (bitcoin.Transaction.SIGHASH_SINGLE |
                        bitcoin.Transaction.SIGHASH_ANYONECANPAY) ||
                psbt.txInputs[0].hash.reverse().toString('hex') !==
                    txHash.replace('0x', '') ||
                psbt.txInputs[0].index != index) {
                this.logger.error('[checkListPsbt] psbt input not match');
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (psbt.txOutputs[0].address !== address ||
                psbt.txOutputs[0].value !== price.toNumber()) {
                this.logger.error('[checkListPsbt] psbt output not match');
                throw new BadRequestException(StatusName.ParameterException);
            }
            if (!psbt.validateSignaturesOfAllInputs(psbtValidator)) {
                this.logger.error('[checkListPsbt] psbt signature validate failed');
                throw new BadRequestException(StatusName.PsbtException);
            }
            const unsignedPsbt = new bitcoin.Psbt({ network: this.network });
            unsignedPsbt.addInputs(psbt.txInputs);
            unsignedPsbt.addOutputs(psbt.txOutputs);
            psbt.data.inputs.forEach((input, index) => {
                if (input.witnessUtxo !== undefined) {
                    unsignedPsbt.updateInput(index, {
                        witnessUtxo: input.witnessUtxo,
                    });
                }
                if (input.tapInternalKey !== undefined) {
                    unsignedPsbt.updateInput(index, {
                        tapInternalKey: input.tapInternalKey,
                    });
                }
            });
            return unsignedPsbt.toHex();
        }
    async filterInactivePurchaseItems(items: ItemEntity[]): Promise<ItemEntity[]> {
            const sellerAddresses = Array.from(new Set(items.map((item) => item.sellerAddress)));
            const utxos = await Promise.all(sellerAddresses.map(async (address) => {
                return {
                    utxos: await this.btcAssetsService.service.getBtcUtxos(address),
                    address,
                };
            }));
            let inactiveItems: any[] = [];
            items.forEach((item) => {
                const addressUtxos = utxos.find((utxo) => utxo.address === item.sellerAddress);
                if (addressUtxos) {
                    const psbt = bitcoin.Psbt.fromHex(item.unsignedPsbt);
                    const inactiveTxInput = psbt.txInputs.find((txInput) => {
                        const txInputHash = Buffer.from(txInput.hash).reverse();
                        const utxo = addressUtxos.utxos.find((utxo) => {
                            return (utxo.txid === txInputHash.toString('hex') &&
                                utxo.vout === txInput.index);
                        });
                        return utxo === undefined || !utxo.status.confirmed;
                    });
                    if (inactiveTxInput) {
                        inactiveItems.push(item);
                    }
                }
                else {
                    inactiveItems = items.filter((innerItem) => innerItem.sellerAddress === item.sellerAddress);
                }
                if (item.btcValue.toNumber() !== 546) {
                    inactiveItems.push(item);
                }
            });
            return inactiveItems;
        }
    verifyCkbTxWithItems(items: any, ckbTx: any) {
            const lockArgsList = items.map((item: any) => {
                return buildRgbppLockArgs(item.index, item.txHash);
            });
            if (!isArraysIdentical(ckbTx.rgbppLockArgsList, lockArgsList)) {
                this.logger.error(`[validateCkbTxParameters] ckb lock args not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
            const typeArgsList = items.map((item: any) => `0x${item.dobs.typeArgs}`);
            if (!isArraysIdentical(ckbTx.sporeTypeArgsList, typeArgsList)) {
                this.logger.error(`[validateCkbTxParameters] ckb type args not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
        }
    async checkBuyRgbppBtcTransaction(buyerSigPsbt: string, items: ItemEntity[], marketFee: string, buyerAddress: string, ckbTx: CKBTransaction): Promise<{
        psbt: bitcoin.Psbt;
        ckbVirtualTxResult: SporeTransferVirtualTxResult;
        btcTxId: string;
    }> {
            this.verifyCkbTxWithItems(items, ckbTx);
            const [ckbVirtualTxResult, buyerUtxos] = await Promise.all([
                this.genBatchSporeCkbVirtualTx(ckbTx.rgbppLockArgsList, ckbTx.sporeTypeArgsList),
                this.service.getBtcUtxos(buyerAddress, {
                    min_satoshi: BTC_UTXO_DUST_LIMIT,
                }),
            ]);
            this.verifyPsbtCommitmentAndFee(buyerSigPsbt, ckbVirtualTxResult.commitment, marketFee);
            try {
                const psbt = this.finalizeBuyerSellerPsbt(buyerSigPsbt, items, buyerUtxos);
                let btcTxId = psbt
                    .extractTransaction()
                    .getHash()
                    .reverse()
                    .toString('hex');
                return { psbt, ckbVirtualTxResult, btcTxId };
            }
            catch (error) {
                this.logger.error(`error ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.PsbtException);
            }
        }
    async genBatchSporeCkbVirtualTx(sporeRgbppLockArgs: string[], sporeTypeArgs: string[]): Promise<SporeTransferVirtualTxResult> {
            const deduplicatedSporeTypeArgs = deduplicateList(sporeTypeArgs);
            const sporeTypeBytesList = deduplicatedSporeTypeArgs.map((args) => append0x(serializeScript({
                ...getSporeTypeScript(this.isMainnet),
                args,
            })));
            const ckbVirtualTxResult = await genBatchTransferSporeCkbVirtualTx({
                collector: this.collector,
                sporeRgbppLockArgs,
                sporeTypeBytesList,
                isMainnet: this.isMainnet,
            });
            this.logger.log(`[genBatchSporeCkbVirtualTx] ${JSON.stringify(ckbVirtualTxResult)}`);
            return ckbVirtualTxResult;
        }
    verifyPsbtCommitmentAndFee(buyerSigPsbt: any, commitment: any, marketFee?: any) {
            const buyerPsbt = bitcoin.Psbt.fromHex(buyerSigPsbt, {
                network: this.network,
            });
            const outputs = buyerPsbt.txOutputs;
            const embedOut = bitcoin.payments.embed({
                data: [Buffer.from(commitment, 'hex')],
            }).output as Buffer;
            if (!outputs[0].script.equals(embedOut)) {
                this.logger.log(` ckbVirtualTxResult.commitment ${embedOut.toString('hex')}, outputs[0].script ${outputs[0].script.toString('hex')}`);
                this.logger.error(`btc commitment not match`);
                throw new BadRequestException(StatusName.CkbException);
            }
            if (marketFee) {
                if (parseInt(marketFee) >= this.appConfigService.rgbPPConfig.minMarketFee) {
                    const output = outputs.find((item) => item.address ===
                        this.appConfigService.rgbPPConfig.receiveFeeAddress);
                    if (!output || output.value != parseInt(marketFee)) {
                        this.logger.error(`output not find market_address or output.value !=marketFee`);
                        throw new BadRequestException(StatusName.PsbtException);
                    }
                }
            }
        }
    finalizeBuyerSellerPsbt(buyerSigPsbt: any, items: any, buyerUtxos: any) {
            let sellerPsbtList = items.map((x: any) => bitcoin.Psbt.fromHex(x.psbtSig, { network: this.network }));
            const buyerPsbt = bitcoin.Psbt.fromHex(buyerSigPsbt, {
                network: this.network,
            });
            const buyerInputs: any[] = [];
            buyerPsbt.txInputs.forEach((input, buyerPsbtInputIndex) => {
                const i = sellerPsbtList.findIndex((v: any) => v.txInputs[0].hash.equals(input.hash) &&
                    v.txInputs[0].index === input.index);
                if (i > -1) {
                    const sellerPsbt = sellerPsbtList[i];
                    sellerPsbtList = sellerPsbtList.filter((_: any, index: any) => i !== index);
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
                const utxo = buyerUtxos.find((buyerUtxo: any) => buyerInputTxHash.equals(Buffer.from(buyerUtxo.txid, 'hex')));
                if (utxo === undefined || !utxo.status.confirmed) {
                    this.logger.error(`buyer utxo expired ${JSON.stringify(utxo)}`);
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
            return buyerPsbt;
        }
    async checkUnlistRgbppBtcTransaction(sigPsbt: string, items: ItemEntity[], ckbTx: CKBTransaction): Promise<{
        psbt: bitcoin.Psbt;
        ckbVirtualTxResult: SporeTransferVirtualTxResult;
        btcTxId: string;
    }> {
            this.verifyCkbTxWithItems(items, ckbTx);
            const ckbVirtualTxResult = await this.genBatchSporeCkbVirtualTx(ckbTx.rgbppLockArgsList, ckbTx.sporeTypeArgsList);
            this.verifyPsbtCommitmentAndFee(sigPsbt, ckbVirtualTxResult.commitment);
            try {
                let psbt = bitcoin.Psbt.fromHex(sigPsbt, {
                    network: this.network,
                });
                psbt = psbt.finalizeAllInputs();
                let btcTxId = psbt
                    .extractTransaction()
                    .getHash()
                    .reverse()
                    .toString('hex');
                return { psbt, ckbVirtualTxResult, btcTxId };
            }
            catch (error) {
                this.logger.error(`[checkUnlistRgbppBtcTransaction] error ${(error as Error)?.stack}`);
                throw new BadRequestException(StatusName.PsbtException);
            }
        }
}
