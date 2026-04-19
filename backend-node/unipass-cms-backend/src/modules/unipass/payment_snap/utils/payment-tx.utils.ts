import { BatchPaymentTableInfo, CustomTxFee, FeeInfo, ParsePayment, PaymentData, PaymentTableInfo } from './interface';
import { format } from 'date-fns';
import { getChainName, getUsdAmount, nativeToken, sortList } from '../../chain/utils';
import { Decimal } from 'decimal.js';
import { getAddress } from 'ethers';

export const getPaymentGasTableInfo = (item: any, app: any, dayUserMap: any, bscUserSMap: any, polygonUserMap: any, arbUserMap: any, usdcPrice: any, usdtPrice: any, info: any, customTxFee: any) => {
    const day = format(new Date(item.date), 'yyyy/MM/dd');
    if (!info) {
        info = initPaymentTableInfo(item.date, day, app);
    }
    let discount = customTxFee ? customTxFee.discount : Number(item.discount);
    let fee = discount == 0 ? 1 : 0;
    let payment = item.data;
    if (!fee)
        payment.pop();
    info.allUserCount = setUserMapSet(dayUserMap, item.date, item.address);
    info.allPaymentCount += payment.length;
    let chainName = getChainName(item.chainId.toString());
    switch (chainName) {
        case 'bsc':
            info.bscFree += fee;
            info.bscPaymentCount += payment.length;
            info.bscUserCount = setUserMapSet(bscUserSMap, item.date, item.address);
            info.bscPaymentUsd = new Decimal(info.bscPaymentUsd)
                .add(new Decimal(getPaymentUsd(usdcPrice, usdtPrice, item.data)))
                .toNumber();
            break;
        case 'polygon':
            info.polygonFree += fee;
            info.polygonPaymentCount += payment.length;
            info.polygonUserCount = setUserMapSet(polygonUserMap, item.date, item.address);
            info.polygonPaymentUsd = new Decimal(info.polygonPaymentUsd)
                .add(new Decimal(getPaymentUsd(usdcPrice, usdtPrice, item.data)))
                .toNumber();
            break;
        case 'arb':
            info.arbFree += fee;
            info.arbPaymentCount += payment.length;
            info.arbUserCount = setUserMapSet(arbUserMap, item.date, item.address);
            info.arbPaymentUsd = new Decimal(info.arbPaymentUsd)
                .add(new Decimal(getPaymentUsd(usdcPrice, usdtPrice, item.data)))
                .toNumber();
            break;
        default:
            break;
    }
    info.allPaymentCount =
        info.arbPaymentCount + info.bscPaymentCount + info.polygonPaymentCount;
    info.allPaymentUsd = new Decimal(info.arbPaymentUsd)
        .add(new Decimal(info.bscPaymentUsd))
        .add(new Decimal(info.polygonPaymentUsd))
        .toNumber();
    info.allFree = info.arbFree + info.bscFree + info.polygonFree;
    return info;
}
export const getAppPaymentTableInfo = (item: any, app: any, dayUserMap: any, bscUserSMap: any, polygonUserMap: any, arbUserMap: any, usdcPrice: any, usdtPrice: any, info: any) => {
    const day = format(new Date(item.date), 'yyyy/MM/dd');
    if (!info) {
        info = initPaymentTableInfo(item.date, day, app);
    }
    info.allPaymentCount += item.output.length;
    info = getAppParsePaymentInfo(item, bscUserSMap, polygonUserMap, arbUserMap, usdcPrice, usdtPrice, info);
    info.allUserCount = setUserMapSet(dayUserMap, item.date, item.address);
    info.allPaymentCount =
        info.arbPaymentCount + info.bscPaymentCount + info.polygonPaymentCount;
    info.allPaymentUsd = new Decimal(info.arbPaymentUsd)
        .add(new Decimal(info.bscPaymentUsd))
        .add(new Decimal(info.polygonPaymentUsd))
        .toNumber();
    info.allFree = info.arbFree + info.bscFree + info.polygonFree;
    return info;
}
const getAppParsePaymentInfo = (item: any, bscUserSMap: any, polygonUserMap: any, arbUserMap: any, usdcPrice: any, usdtPrice: any, info: any) => {
    let freeQuota = item.freeQuota;
    for (let tx of item.output) {
        let txInfo = tx.split(',');
        let chainName = getChainName(txInfo[3]);
        let erc20Transfer = [
            {
                amount: txInfo[1],
                contractAddress: txInfo[2],
                cid: Number(txInfo[4]),
            },
        ];
        switch (chainName) {
            case 'polygon':
                info.polygonPaymentCount += 1;
                info.polygonUserCount = setUserMapSet(polygonUserMap, item.date, item.address);
                info.polygonPaymentUsd = new Decimal(info.polygonPaymentUsd)
                    .add(new Decimal(getPaymentUsd(usdcPrice, usdtPrice, erc20Transfer)))
                    .toNumber();
                if (freeQuota > 0) {
                    info.polygonFree += 1;
                    --freeQuota;
                }
                break;
            case 'bsc':
                info.bscPaymentCount += 1;
                info.bscUserCount = setUserMapSet(bscUserSMap, item.date, item.address);
                info.bscPaymentUsd = new Decimal(info.bscPaymentUsd)
                    .add(new Decimal(getPaymentUsd(usdcPrice, usdtPrice, erc20Transfer)))
                    .toNumber();
                if (freeQuota > 0) {
                    info.bscFree += 1;
                    --freeQuota;
                }
                break;
            case 'arb':
                info.arbPaymentCount += 1;
                info.arbPaymentUsd = new Decimal(info.arbPaymentUsd)
                    .add(new Decimal(getPaymentUsd(usdcPrice, usdtPrice, erc20Transfer)))
                    .toNumber();
                info.arbUserCount = setUserMapSet(arbUserMap, item.date, item.address);
                if (freeQuota > 0) {
                    info.arbFree += 1;
                    --freeQuota;
                }
                break;
            default:
                break;
        }
    }
    return info;
}
const initPaymentTableInfo = (date: any, day: any, app: any) => {
    let data = {
        date: date,
        day: day,
        app: app,
        allPaymentCount: 0,
        allUserCount: 0,
        allPaymentUsd: 0,
        allFree: 0,
        bscFree: 0,
        bscUserCount: 0,
        bscPaymentCount: 0,
        arbFree: 0,
        arbUserCount: 0,
        arbPaymentCount: 0,
        polygonFree: 0,
        polygonUserCount: 0,
        polygonPaymentCount: 0,
        bscPaymentUsd: 0,
        arbPaymentUsd: 0,
        polygonPaymentUsd: 0,
    };
    return data;
}
const setUserMapSet = (userMap: any, date: any, address: any) => {
    let addressSet = userMap.get(date);
    if (!addressSet) {
        addressSet = new Set();
    }
    addressSet.add(address);
    userMap.set(date, addressSet);
    return addressSet.size;
}
export const getAllPaymentList = (list: any, start: any, end: any, allUser: any) => {
    list = sortList(list);
    start = format(new Date(start), 'yyyy/MM/dd');
    end = format(new Date(end), 'yyyy/MM/dd HH:mm:ss');
    let all = initPaymentTableInfo(`${start}-${end}`, `${start}-${end}`, 'Total');
    all.allUserCount = allUser;
    for (let item of list) {
        all.allPaymentCount += item.allPaymentCount;
        all.bscFree += item.bscFree;
        all.bscUserCount += item.bscUserCount;
        all.bscPaymentCount += item.bscPaymentCount;
        all.arbFree += item.arbFree;
        all.arbUserCount += item.arbUserCount;
        all.arbPaymentCount += item.arbPaymentCount;
        all.polygonFree += item.polygonFree;
        all.polygonUserCount += item.polygonUserCount;
        all.polygonPaymentCount += item.polygonPaymentCount;
        all.allPaymentUsd = new Decimal(item.allPaymentUsd)
            .add(new Decimal(all.allPaymentUsd))
            .toNumber();
        all.polygonPaymentUsd = new Decimal(item.polygonPaymentUsd)
            .add(new Decimal(all.polygonPaymentUsd))
            .toNumber();
        all.arbPaymentUsd = new Decimal(item.arbPaymentUsd)
            .add(new Decimal(all.arbPaymentUsd))
            .toNumber();
        all.bscPaymentUsd = new Decimal(item.bscPaymentUsd)
            .add(new Decimal(all.bscPaymentUsd))
            .toNumber();
        all.allFree += item.allFree;
    }
    list.push(all);
    return list;
}
const getPaymentUsd = (usdcPrice: any, usdtPrice: any, erc20Transfer: any) => {
    let payUsd = 0;
    if (!erc20Transfer) {
        return payUsd;
    }
    for (let transfer of erc20Transfer) {
        if (transfer.cid === 825) {
            payUsd = new Decimal(usdtPrice)
                .mul(new Decimal(transfer.amount))
                .add(new Decimal(payUsd))
                .toNumber();
        }
        else if (transfer.cid === 3408) {
            payUsd = new Decimal(usdcPrice)
                .mul(new Decimal(transfer.amount))
                .add(new Decimal(payUsd))
                .toNumber();
        }
    }
    return getUsdAmount(payUsd);
}
export const getSnapBatchPaymentTableInfo = (item: any, app: any, bscUserSMap: any, polygonUserMap: any, arbUserMap: any, allUserMap: any, info: any) => {
    const day = format(new Date(item.date), 'yyyy/MM/dd');
    if (!info) {
        info = initBatchPaymentTableInfo(item.date, day, app);
    }
    let chainName = getChainName(item.chainId.toString());
    switch (chainName) {
        case 'bsc':
            info.bscInputTxHashCount += 1;
            info.bscPaymentCount += item.data.length;
            info.bscUserCount = setUserMapSet(bscUserSMap, item.date, item.address);
            break;
        case 'polygon':
            info.polygonInputTxHashCount += 1;
            info.polygonPaymentCount += item.data.length;
            info.polygonUserCount = setUserMapSet(polygonUserMap, item.date, item.address);
            break;
        case 'arb':
            info.arbInputTxHashCount += 1;
            info.arbPaymentCount += item.data.length;
            info.arbUserCount = setUserMapSet(arbUserMap, item.date, item.address);
            break;
        default:
            break;
    }
    info.allPaymentCount =
        info.polygonPaymentCount + info.bscPaymentCount + info.arbPaymentCount;
    info.allInputTxHashCount =
        info.arbInputTxHashCount +
            info.polygonInputTxHashCount +
            info.bscInputTxHashCount;
    info.allUserTxCount = setUserMapSet(allUserMap, item.date, item.address);
    return info;
}
const initBatchPaymentTableInfo = (date: any, day: any, app: any) => {
    let data = {
        date: date,
        day: day,
        app: app,
        allPaymentCount: 0,
        allInputTxHashCount: 0,
        allUserTxCount: 0,
        bscUserCount: 0,
        bscPaymentCount: 0,
        bscInputTxHashCount: 0,
        arbUserCount: 0,
        arbPaymentCount: 0,
        arbInputTxHashCount: 0,
        polygonUserCount: 0,
        polygonPaymentCount: 0,
        polygonInputTxHashCount: 0,
    };
    return data;
}
export const getAllBatchPaymentList = (list: any, start: any, end: any, allUserTxCount: any) => {
    list = sortList(list);
    start = format(new Date(start), 'yyyy/MM/dd');
    end = format(new Date(end), 'yyyy/MM/dd HH:mm:ss');
    let all = initBatchPaymentTableInfo(`${start}-${end}`, `${start}-${end}`, 'Total');
    all.allUserTxCount = allUserTxCount;
    for (let item of list) {
        all.allPaymentCount += item.allPaymentCount;
        all.allInputTxHashCount += item.allInputTxHashCount;
        all.bscUserCount += item.bscUserCount;
        all.bscInputTxHashCount += item.bscInputTxHashCount;
        all.bscPaymentCount += item.bscPaymentCount;
        all.arbUserCount += item.arbUserCount;
        all.arbInputTxHashCount += item.arbInputTxHashCount;
        all.arbPaymentCount += item.arbPaymentCount;
        all.polygonUserCount += item.polygonUserCount;
        all.polygonInputTxHashCount += item.polygonInputTxHashCount;
        all.polygonPaymentCount += item.polygonPaymentCount;
    }
    list.push(all);
    return list;
}
export const parsePaymentData = (list: any) => {
    let paymentData = new Map();
    for (let item of list) {
        let payment = {
            address: item.address,
            id: item.id,
            paymentAmount: item.paymentAmount,
            feeAmount: item.feeAmount,
            freeQuota: item.freeQuota,
            date: item.date,
        };
        let data = paymentData.get(item.id);
        if (!data) {
            data = {
                ...payment,
                output: [],
                input: [],
            };
        }
        if (item.outputTo) {
            const outputToken = nativeToken[item.outputChainId];
            const contractAddress = getAddress(item.outputTokenAddress);
            let outputData = `${item.outputTo},${item.outputAmount},${item.outputTo},${item.outputChainId},${outputToken[contractAddress].cid}`;
            if (!data.output.includes(outputData)) {
                data.output.push(outputData);
            }
        }
        if (item.subPaymentType === 2) {
            const outputToken = nativeToken[item.inputChainId];
            const contractAddress = getAddress(item.subTokenAddress);
            let outputData = `${item.subOutputTo},${item.subAmount},${item.subTokenAddress},${item.inputChainId},${outputToken[contractAddress].cid}`;
            if (!data.output.includes(outputData)) {
                data.output.push(outputData);
            }
        }
        if (item.inputTxHash) {
            let inputData = `${item.inputTxHash},${item.inputChainId}`;
            if (!data.input.includes(inputData)) {
                data.input.push(inputData);
            }
        }
        paymentData.set(item.id, data);
    }
    let _list = [];
    for (let [k, v] of paymentData) {
        _list.push(v);
    }
    return _list;
}
export const getAppBatchPaymentTableInfo = (item: any, bscUserSMap: any, polygonUserMap: any, arbUserMap: any, allUserMap: any, info: any) => {
    const day = format(new Date(item.date), 'yyyy/MM/dd');
    if (!info) {
        info = initBatchPaymentTableInfo(item.date, day, 'App');
    }
    info = setPaymentCount(info, item.output, bscUserSMap, polygonUserMap, arbUserMap, item.date, item.address);
    info = setInputTxCount(info, item.input);
    info.allPaymentCount =
        info.bscPaymentCount + info.arbPaymentCount + info.polygonPaymentCount;
    info.allInputTxHashCount =
        info.arbInputTxHashCount +
            info.polygonInputTxHashCount +
            info.bscInputTxHashCount;
    info.allUserTxCount = setUserMapSet(allUserMap, item.date, item.address);
    return info;
}
const setPaymentCount = (info: any, output: any, bscUserSMap: any, polygonUserMap: any, arbUserMap: any, date: any, address: any) => {
    for (let payment of output) {
        let paymentList = payment.split(',');
        let chainName = getChainName(paymentList[3]);
        switch (chainName) {
            case 'bsc':
                info.bscPaymentCount += 1;
                info.bscUserCount = setUserMapSet(bscUserSMap, date, address);
                break;
            case 'polygon':
                info.polygonPaymentCount += 1;
                info.polygonUserCount = setUserMapSet(polygonUserMap, date, address);
                break;
            case 'arb':
                info.arbPaymentCount += 1;
                info.arbUserCount = setUserMapSet(arbUserMap, date, address);
                break;
            default:
                break;
        }
    }
    return info;
}
const setInputTxCount = (info: any, input: any) => {
    for (let payment of input) {
        let paymentList = payment.split(',');
        let chainName = getChainName(paymentList[1]);
        switch (chainName) {
            case 'bsc':
                info.bscInputTxHashCount += 1;
                break;
            case 'polygon':
                info.polygonInputTxHashCount += 1;
                break;
            case 'arb':
                info.arbInputTxHashCount += 1;
                break;
            default:
                break;
        }
    }
    return info;
}
