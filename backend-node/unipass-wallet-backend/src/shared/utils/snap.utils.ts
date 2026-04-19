import moment from 'moment';

export const initSignMessasg = (message: any) => {
    const rawMessage = '';
    try {
        const dataList = message.split('Expiration Time: ');
        if (dataList.length === 0) {
            return rawMessage;
        }
        const expirationTime = dataList[1].split('\n')[0];
        const diff = moment().diff(moment(expirationTime), 's');
        if (diff > 0) {
            return rawMessage;
        }
        return message;
    }
    catch (error) {
        console.warn({ error });
        return rawMessage;
    }
};
