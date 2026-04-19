import { ITransaction } from '../../../../entities/relayer/relaye.transactions.entity';
import { getUnipassWalletContext, nativeToken } from '../../chain/utils';
import { Interface, formatUnits, toBeHex } from 'ethers';
import { ModuleMainInterface } from '@unipasswallet/utils';
import { erc20, gasEstimator, moduleGuest, moduleHookEIP4337Wallet, moduleMain, moduleMainGasEstimator, moduleMainUpgradable, multiCall, singletonFactory } from '@unipasswallet/abi';

const getDataMethod = (ret: any, functionName: any, method: any) => {
    for (let item of ret._txs) {
        const itemFunctionName = item.data.slice(0, 10);
        if (itemFunctionName === functionName[0]) {
            try {
                const innerTx = ModuleMainInterface.decodeFunctionData(method, item.data);
                return getDataMethod(innerTx, functionName, method);
            }
            catch (error) {
                functionName.push(itemFunctionName === '0xa9059cbb'
                    ? 'transfer_erc20'
                    : itemFunctionName);
                console.error(error);
            }
        }
        else if (itemFunctionName === '0xc9b4a46a') {
            try {
                const innerTx = ModuleMainInterface.decodeFunctionData('selfExecute', item.data);
                return getDataMethod(innerTx, functionName, method);
            }
            catch (error) {
                functionName.push(itemFunctionName === '0xa9059cbb'
                    ? 'transfer_erc20'
                    : itemFunctionName);
                console.error(error);
            }
        }
        else {
            if (itemFunctionName === '0x2ca9e7d0') {
                const innerTx = ModuleMainInterface.decodeFunctionData(method, item.data);
                return getDataMethod(innerTx, functionName, method);
            }
            functionName.push(itemFunctionName === '0xa9059cbb' ? 'transfer_erc20' : itemFunctionName);
        }
    }
    return functionName;
}
export const parseData = (tx: any) => {
    const { to, data } = tx;
    const interactWithAddress = to;
    const moduleGuestAddress = getUnipassWalletContext().moduleGuest;
    const functionName = data.slice(0, 10);
    let methods = [];
    if (functionName === '0x2ca9e7d0') {
        const ret = ModuleMainInterface.decodeFunctionData('execute', data);
        methods = getDataMethod(ret, [], 'execute');
    }
    if (methods[methods.length - 1] == '0x') {
        methods[methods.length - 1] = 'transfer_nativegas';
    }
    else if (methods[methods.length - 1] == '0xa9059cbb') {
        methods[methods.length - 1] = 'transfer_erc20';
    }
    methods = getFunctionAbi(methods);
    return {
        interactWithAddress,
        functionAbi: `execute(${methods.join(',')})`,
        moduleGuestAddress,
    };
}
export const decodeTransactionData = (tx: any, details: any) => {
    let functionAbis = 'Unknown';
    if (!details) {
        return functionAbis;
    }
    try {
        const { functionAbi } = parseData(tx);
        functionAbis = functionAbi;
    }
    catch (error) {
        console.error(error);
    }
    return functionAbis;
}
const getFunctionAbi = (methodName: any) => {
    const methodIdMap = new Map();
    const abi = [
        ...moduleGuest.abi,
        ...moduleMain.abi,
        ...moduleMainUpgradable.abi,
        ...erc20.abi,
        ...multiCall.abi,
        ...singletonFactory.abi,
        ...moduleMainGasEstimator.abi,
        ...moduleHookEIP4337Wallet.abi,
        ...gasEstimator.abi,
    ];
    for (let item of abi) {
        const isFunction = item.type === 'function';
        if (!isFunction) {
            continue;
        }
        const functionSignature = new Interface([item]).getFunction(item.name)?.selector ?? '';
        methodIdMap.set(functionSignature, item.name);
    }
    let methods = [];
    for (let item of methodName) {
        const name = methodIdMap.get(item);
        if (name) {
            methods.push(name);
        }
        else {
            methods.push(item);
        }
    }
    return methods;
}
export const paseSelfExecute = (innerFeeTx: any) => {
    let functionName = innerFeeTx.data.slice(0, 10);
    if (functionName === '0xc9b4a46a') {
        const ret = ModuleMainInterface.decodeFunctionData('selfExecute', innerFeeTx.data);
        innerFeeTx = ret._txs[ret._txs.length - 1];
        functionName = innerFeeTx.data.slice(0, 10);
        if (functionName === '0xc9b4a46a') {
            paseSelfExecute(innerFeeTx);
        }
        return innerFeeTx;
    }
    return innerFeeTx;
}
const decodeErc20Transfer = (innerFeeTx: any, chainId: any) => {
    const contractInterface = new Interface(erc20.abi);
    const ret = contractInterface.decodeFunctionData('transfer', innerFeeTx.data);
    const contractAddress = innerFeeTx.target;
    const tokenInfo = nativeToken[chainId];
    const decimals = tokenInfo ? tokenInfo[contractAddress].decimals : 'ether';
    const amount = formatUnits(toBeHex(ret.amount), decimals);
    return {
        amount,
        contractAddress,
        cid: tokenInfo ? tokenInfo[contractAddress].cid : 825,
    };
}
export const decodeErc20TransferByData = (tx: any, chianId: any) => {
    const { to, data } = tx;
    const ret = ModuleMainInterface.decodeFunctionData('execute', data);
    let erc20Transfer = getErc20transactionData(ret, 'execute', '0xa9059cbb', []);
    let transfer = erc20Transfer.map((transfer: any) => decodeErc20Transfer(transfer, chianId));
    return transfer;
}
const getErc20transactionData = (ret: any, method: any, erc20Method: any, erc20Data: any) => {
    for (let item of ret._txs) {
        const itemFunctionName = item.data.slice(0, 10);
        if (itemFunctionName === '0x2ca9e7d0') {
            try {
                const innerTx = ModuleMainInterface.decodeFunctionData(method, item.data);
                erc20Data = getErc20transactionData(innerTx, method, erc20Method, erc20Data);
            }
            catch (error) {
                console.error(error);
            }
        }
        else if (itemFunctionName === '0xc9b4a46a') {
            try {
                const innerTx = ModuleMainInterface.decodeFunctionData('selfExecute', item.data);
                erc20Data = getErc20transactionData(innerTx, method, erc20Method, erc20Data);
            }
            catch (error) {
                console.error(error);
            }
        }
        else if (itemFunctionName === erc20Method) {
            erc20Data.push(item);
        }
    }
    return erc20Data;
}
