import { AddressType, DataSource, NetworkType, TxBuilder, bitcoin, decodeAddress, ecc, remove0x, toXOnly, tweakSigner } from '@rgbpp-sdk/btc';
import { BtcAssetsApi } from '@rgbpp-sdk/service';
import { ItemEntity } from '../../../database/entities';
import { ItemPSBT } from '../../../modules/collection/dto/buy.items.output.dto';
import { Psbt, payments } from 'bitcoinjs-lib';
import { SporeTransferVirtualTxResult } from '../../../common/rgbpp/sport.batch.transfer';
import Ecpair from 'ecpair';
import { testnet } from 'bitcoinjs-lib/src/networks';

require("dotenv/config");
const privateKey2 = process.env.BTC_TEST_PRIVATE_KEY2;
export function getTxSize(psbt: any, addressType: any, sellerCount = 0) {
    const network = bitcoin.networks.testnet;
    const ECPair = Ecpair(ecc);
    const keyPair = ECPair.makeRandom({ network });
    let scriptPubKey = null;
    if (addressType === AddressType.P2WPKH) {
        const { output } = payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network,
        });
        scriptPubKey = output;
    }
    else if (addressType === AddressType.P2TR) {
        const { output } = payments.p2tr({
            internalPubkey: toXOnly(keyPair.publicKey),
            network,
        });
        scriptPubKey = output;
    }
    const inputs = psbt.data.inputs.map((input: any, index: any) => {
        const txInput = psbt.txInputs[index];
        const isSeller = index > 0 && index <= sellerCount;
        if (input.tapInternalKey) {
            return {
                hash: txInput.hash.reverse().toString('hex'),
                index: txInput.index,
                sequence: txInput.sequence,
                sighashTypes: isSeller
                    ? [
                        bitcoin.Transaction.SIGHASH_SINGLE |
                            bitcoin.Transaction.SIGHASH_ANYONECANPAY,
                    ]
                    : [bitcoin.Transaction.SIGHASH_ALL],
                witnessUtxo: {
                    script: scriptPubKey,
                    value: input.witnessUtxo.value,
                },
                tapInternalKey: input.tapInternalKey,
            };
        }
        else {
            return {
                hash: txInput.hash.reverse().toString('hex'),
                index: txInput.index,
                sequence: txInput.sequence,
                witnessUtxo: {
                    script: scriptPubKey,
                    value: input.witnessUtxo.value,
                },
            };
        }
    });
    const outputs = psbt.data.outputs.map((_output: any, index: any) => {
        const txOutput = psbt.txOutputs[index];
        return {
            address: txOutput.address,
            script: txOutput.script,
            value: txOutput.value,
        };
    });
    const vPsbt = new Psbt({ network });
    inputs.forEach((input: any) => {
        vPsbt.addInput(input);
    });
    outputs.forEach((output: any) => {
        vPsbt.addOutput(output);
    });
    vPsbt.data.inputs.forEach((input, index) => {
        if (input.tapInternalKey) {
            const tweakedSigner = tweakSigner(keyPair, {
                network: testnet,
            });
            vPsbt.signInput(index, tweakedSigner);
        }
        else {
            vPsbt.signInput(index, keyPair);
        }
    });
    vPsbt.finalizeAllInputs();
    const tx = vPsbt.extractTransaction(true);
    return tx.virtualSize();
}
export const initBuyerPsbt = async (assetService: any, items: any, buyerUtxoTxId: any, buyerUtxoIndex: any, ckbVirtualTxResult: any, sellerPsbts: any, fixedFeeRate = 30) => {
    const ECPair = Ecpair(ecc);
    const testnet = bitcoin.networks.testnet;
    const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey2 as string, 'hex'), {
        network: testnet,
    });
    const network = bitcoin.networks.testnet;
    const source = new DataSource(assetService, NetworkType.TESTNET);
    const buyerPsbt = new bitcoin.Psbt({ network });
    const buyerUtxo = (await source.getUtxo(buyerUtxoTxId, buyerUtxoIndex)) as any;
    const addressType = decodeAddress(buyerUtxo.address).addressType;
    let address: string = '';
    const internalPubkey = toXOnly(keyPair.publicKey);
    if (addressType === AddressType.P2WPKH) {
        const data = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: testnet,
        });
        address = data.address as string;
        buyerPsbt.addInput({
            hash: buyerUtxo.txid,
            index: buyerUtxo.vout,
            witnessUtxo: {
                value: buyerUtxo.value,
                script: Buffer.from(remove0x(buyerUtxo.scriptPk), 'hex'),
            },
        });
    }
    else if (addressType === AddressType.P2TR) {
        const data = payments.p2tr({
            internalPubkey,
            network,
        });
        address = data.address as string;
        buyerPsbt.addInput({
            hash: buyerUtxo.txid,
            index: buyerUtxo.vout,
            witnessUtxo: {
                value: buyerUtxo.value,
                script: data.output as Buffer,
            },
            tapInternalKey: internalPubkey,
        });
    }
    const utxos: any[] = [];
    for (const item of items) {
        const utxo = (await source.getUtxo(item.txHash, item.index)) as any;
        if (addressType === AddressType.P2WPKH) {
            utxos.push(utxo);
        }
        else if (addressType === AddressType.P2TR) {
            utxos.push({ ...utxo, pubkey: internalPubkey.toString('hex') });
        }
        utxos.push(utxo);
    }
    const embed = bitcoin.payments.embed({
        data: [Buffer.from(remove0x(ckbVirtualTxResult.commitment), 'hex')],
    });
    buyerPsbt.addOutput({
        value: 0,
        script: embed.output as Buffer,
    });
    const rgbppPsbts = sellerPsbts.map((sellerPsbt: any) => {
        return Psbt.fromHex(sellerPsbt.psbt, { network });
    });
    addRgbppTransfer(buyerPsbt, rgbppPsbts, address);
    const txBuilder = new TxBuilder({ source, minUtxoSatoshi: 546 });
    if (addressType === AddressType.P2WPKH) {
        txBuilder.addInput(buyerUtxo);
    }
    else if (addressType === AddressType.P2TR) {
        txBuilder.addInput({
            ...buyerUtxo,
            pubkey: internalPubkey.toString('hex'),
        });
    }
    txBuilder.addOutputs(buyerPsbt.txOutputs.map((v) => ({
        address: v.address as string,
        value: v.value,
        script: v.script,
        fixed: true,
    })));
    const vB = getTxSize(buyerPsbt, addressType, items.length);
    const gasFee = BigInt(vB * fixedFeeRate);
    await txBuilder.payFee({ address });
    const psbt = txBuilder.toPsbt();
    buyerPsbt.addOutput(psbt.txOutputs[psbt.txOutputs.length - 1]);
    if (addressType === AddressType.P2WPKH) {
        buyerPsbt.signAllInputs(keyPair);
    }
    else if (addressType === AddressType.P2TR) {
        const tweakedSigner = tweakSigner(keyPair, { network });
        buyerPsbt.signAllInputs(tweakedSigner);
    }
    return {
        psbt: buyerPsbt.toHex(),
        fee: gasFee.toString(),
        address,
    };
};
function addRgbppTransfer(originPsbt: any, rgbppPsbts: any, address: any) {
    const outputsToAdd: any[] = [];
    rgbppPsbts.forEach((rgbppPsbt: any) => {
        const rgbppInputs = rgbppPsbt.data.inputs.map((input: any, index: any) => {
            const txInput = rgbppPsbt.txInputs[index];
            if (input.tapInternalKey) {
                return {
                    hash: txInput.hash.reverse().toString('hex'),
                    index: txInput.index,
                    sequence: txInput.sequence,
                    witnessUtxo: input.witnessUtxo,
                    sighashTypes: [input.sighashType],
                    tapInternalKey: input.tapInternalKey,
                };
            }
            return {
                hash: txInput.hash.reverse().toString('hex'),
                index: txInput.index,
                sequence: txInput.sequence,
                witnessUtxo: input.witnessUtxo,
                sighashTypes: [input.sighashType],
            };
        });
        rgbppInputs.forEach((input: any) => {
            originPsbt.addInput(input);
        });
        const rgbppOutputs = rgbppPsbt.data.outputs.map((_output: any, index: any) => {
            const txOutput = rgbppPsbt.txOutputs[index];
            return {
                address: txOutput.address,
                value: txOutput.value,
                script: txOutput.script,
            };
        });
        rgbppOutputs.forEach((output: any) => {
            originPsbt.addOutput(output);
        });
        rgbppInputs.forEach((input: any) => {
            outputsToAdd.push({
                address,
                value: input.witnessUtxo.value,
            });
        });
    });
    outputsToAdd.forEach(({ address, value }) => {
        originPsbt.addOutput({
            address,
            value,
        });
    });
}
export const unlistItemPsbt = async (assetService: any, items: any, buyerUtxoTxId: any, buyerUtxoIndex: any, ckbVirtualTxResult: any, sellerPsbtStr: any, fixedFeeRate = 30) => {
    const ECPair = Ecpair(ecc);
    const network = bitcoin.networks.testnet;
    const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey as string, 'hex'), {
        network,
    });
    const source = new DataSource(assetService, NetworkType.TESTNET);
    const buyerUtxo = (await source.getUtxo(buyerUtxoTxId, buyerUtxoIndex)) as any;
    const addressType = decodeAddress(buyerUtxo.address).addressType;
    const unlistPsbt = new Psbt({ network });
    const sellerPsbt = Psbt.fromHex(sellerPsbtStr, { network });
    const internalPubkey = toXOnly(keyPair.publicKey);
    let address: string = '';
    if (addressType === AddressType.P2WPKH) {
        const data = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: testnet,
        });
        address = data.address as string;
        unlistPsbt.addInput({
            hash: buyerUtxo.txid,
            index: buyerUtxo.vout,
            witnessUtxo: {
                value: buyerUtxo.value,
                script: Buffer.from(remove0x(buyerUtxo.scriptPk), 'hex'),
            },
        });
    }
    else if (addressType === AddressType.P2TR) {
        const data = bitcoin.payments.p2tr({
            internalPubkey,
            network: testnet,
        });
        address = data.address as string;
        unlistPsbt.addInput({
            hash: buyerUtxo.txid,
            index: buyerUtxo.vout,
            witnessUtxo: {
                value: buyerUtxo.value,
                script: data.output as Buffer,
            },
            tapInternalKey: internalPubkey,
        });
    }
    const utxos: any[] = [];
    for (const item of items) {
        const utxo = (await source.getUtxo(item.txHash, item.index)) as any;
        if (addressType === AddressType.P2WPKH) {
            utxos.push(utxo);
        }
        else if (addressType === AddressType.P2TR) {
            utxos.push({ ...utxo, pubkey: internalPubkey.toString('hex') });
        }
    }
    const totalNeed = BigInt(sellerPsbt.data.inputs[0].witnessUtxo?.value ?? 0);
    const embed = bitcoin.payments.embed({
        data: [Buffer.from(remove0x(ckbVirtualTxResult.commitment), 'hex')],
    });
    unlistPsbt.addOutput({
        value: 0,
        script: embed.output as Buffer,
    });
    if (addressType === AddressType.P2WPKH) {
        unlistPsbt.addInput({
            hash: sellerPsbt.txInputs[0].hash.reverse().toString('hex'),
            index: sellerPsbt.txInputs[0].index,
            witnessUtxo: sellerPsbt.data.inputs[0].witnessUtxo,
        });
    }
    else if (addressType === AddressType.P2TR) {
        unlistPsbt.addInput({
            hash: sellerPsbt.txInputs[0].hash.reverse().toString('hex'),
            index: sellerPsbt.txInputs[0].index,
            witnessUtxo: sellerPsbt.data.inputs[0].witnessUtxo,
            tapInternalKey: internalPubkey,
        });
    }
    unlistPsbt.addOutput({
        address: buyerUtxo.address,
        value: Number(totalNeed),
    });
    const txBuilder = new TxBuilder({ source, minUtxoSatoshi: 546 });
    if (addressType === AddressType.P2WPKH) {
        txBuilder.addInput(buyerUtxo);
    }
    else if (addressType === AddressType.P2TR) {
        txBuilder.addInput({
            ...buyerUtxo,
            pubkey: internalPubkey.toString('hex'),
        });
    }
    txBuilder.addInputs(utxos);
    txBuilder.addOutputs(unlistPsbt.txOutputs.map((v) => ({
        address: v.address as string,
        value: v.value,
        script: v.script,
        fixed: true,
    })));
    const vB = getTxSize(unlistPsbt, addressType, 1);
    const gasFee = BigInt(vB * fixedFeeRate);
    await txBuilder.payFee({ address });
    const psbt = txBuilder.toPsbt();
    unlistPsbt.addOutput(psbt.txOutputs[psbt.txOutputs.length - 1]);
    if (addressType === AddressType.P2WPKH) {
        unlistPsbt.signAllInputs(keyPair);
    }
    else if (addressType === AddressType.P2TR) {
        const tweakedSigner = tweakSigner(keyPair, { network });
        unlistPsbt.signAllInputs(tweakedSigner);
    }
    return {
        psbt: unlistPsbt.toHex(),
        fee: gasFee.toString(),
        address,
    };
};
export const listItemData = {
    txHash: 'c714df43fb4158b3c1cf1ec78d894b47d7b8873df90d84c5a32a0c7e80189077',
    index: 38,
    value: 546,
    sporeTypeHash: '0xe6ad82e3b8d3bf119f8c194b0fa7d965b5f202190ae1cf1a74921c56adc21094',
    sporeArgs: '0xccf0fbe5d5787d5ddd31be3c24832f800a23e1ef983066f7c8156d8435329f6b',
    prevBg: null,
    prevBgColor: null,
    dobId: '36',
    prevType: null,
    name: 'Dobs Demo',
    status: 2,
};
const privateKey = process.env.BTC_TEST_PRIVATE_KEY;
export const initListPsbt = async (assetService: any, listBtcValue: any) => {
    const ECPair = Ecpair(ecc);
    const testnet = bitcoin.networks.testnet;
    const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey as string, 'hex'), {
        network: testnet,
    });
    const sighashType = bitcoin.Transaction.SIGHASH_SINGLE |
        bitcoin.Transaction.SIGHASH_ANYONECANPAY;
    const source = new DataSource(assetService, NetworkType.TESTNET);
    const utxo = (await source.getUtxo(listItemData.txHash, listItemData.index)) as any;
    const addressType = decodeAddress(utxo.address).addressType;
    const listPsbtInput = {
        hash: exports.listItemData.txHash,
        index: exports.listItemData.index,
        sighashType,
        witnessUtxo: {
            value: exports.listItemData.value,
            script: Buffer.from(remove0x(utxo.scriptPk), 'hex'),
        },
    };
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
    let address: string = '';
    if (addressType === AddressType.P2WPKH) {
        const data = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: testnet,
        });
        address = data.address as string;
        psbt.addInput(listPsbtInput);
    }
    else {
        const internalPubkey = toXOnly(keyPair.publicKey);
        const data = bitcoin.payments.p2tr({
            internalPubkey,
            network: testnet,
        });
        address = data.address as string;
        listPsbtInput.witnessUtxo.script = data.output as any;
        psbt.addInput({ ...listPsbtInput, tapInternalKey: internalPubkey });
    }
    psbt.addOutput({ address, value: listBtcValue });
    const unsigPsbt = psbt.toHex();
    if (addressType === AddressType.P2WPKH) {
        psbt.signInput(0, keyPair, [sighashType]);
    }
    else if (addressType === AddressType.P2TR) {
        const tweakedSigner = tweakSigner(keyPair, { network: testnet });
        psbt.signInput(0, tweakedSigner, [sighashType]);
    }
    const psbtHex = psbt.toHex();
    return { unsigPsbt, psbtHex, address };
};
