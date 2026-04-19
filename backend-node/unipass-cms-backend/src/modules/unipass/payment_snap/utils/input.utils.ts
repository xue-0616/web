import { format } from 'date-fns';

export function initTime(start?: string | Date, end?: string | Date): [string, string] {
    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : startDate;
    return [
        format(startDate, 'yyyy-MM-dd'),
        `${format(endDate, 'yyyy-MM-dd')} 23:59:59`,
    ];
}

export function sortList<T extends { app?: string; date?: string | Date }>(list: T[]): T[] {
    list.sort((a, b) => {
        const appComparison = (a.app || '').localeCompare(b.app || '');
        if (appComparison !== 0) {
            return appComparison;
        }
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });
    return list;
}

export const getTokenAmount = (token: number) => {
    token = Math.floor(token * 1000000) / 1000000;
    return token;
};

export const getUsdAmount = (usd: number) => {
    usd = Math.floor(usd * 100) / 100;
    return usd;
};
