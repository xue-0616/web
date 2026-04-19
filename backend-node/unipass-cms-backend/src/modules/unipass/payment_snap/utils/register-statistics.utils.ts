import { PaymentAccount, SnapPaymentRegisterInfo } from './interface';
import { format } from 'date-fns';
import { sortList } from './input.utils';

const initSnapPaymentRegisterInfo = (date: any, day: any, app: any) => {
    let data = {
        date: date,
        day,
        app,
        address: [],
        apple: 0,
        google: 0,
        totalRegister: 0,
        deployed: 0,
        notDeployed: 0,
        metamask: 0,
        bnbCount: 0,
        arbCount: 0,
        polygonCount: 0,
    };
    return data;
}
export const getPaymentRegisterInfo = (list: any, app: any) => {
    let dailyAddress = new Map();
    for (let item of list) {
        let data = dailyAddress.get(item.date);
        if (!data) {
            const day = format(new Date(item.date), 'yyyy/MM/dd');
            data = initSnapPaymentRegisterInfo(item.date, day, app);
        }
        if (!data.address.includes(item.address)) {
            data.address.push(item.address);
        }
        if (app === 'App') {
            data.apple += item.provider == 1 ? 1 : 0;
            data.google += item.provider == 0 ? 1 : 0;
        }
        else if (app === 'Snap') {
            data.metamask += item.provider == 0 ? 1 : 0;
        }
        data.totalRegister = data.address.length;
        dailyAddress.set(item.date, data);
    }
    return dailyAddress;
}
export const getAllDailyRegisterList = (list: any, start: any, end: any) => {
    list = sortList(list);
    start = format(new Date(start), 'yyyy/MM/dd');
    end = format(new Date(end), 'yyyy/MM/dd HH:mm:ss');
    const total = initSnapPaymentRegisterInfo(`${start}-${end}`, `${start}-${end}`, 'Total');
    for (let item of list) {
        total.totalRegister += item.totalRegister;
        total.deployed += item.deployed;
        total.notDeployed += item.notDeployed;
        total.arbCount += item.arbCount;
        total.polygonCount += item.polygonCount;
        total.bnbCount += item.bnbCount;
        total.google += item.google;
        total.apple += item.apple;
        total.metamask += item.metamask;
    }
    delete (total as any).address;
    list.push(total);
    return list;
}
