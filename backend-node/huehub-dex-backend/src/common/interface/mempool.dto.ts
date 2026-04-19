export interface MempoolUsdPrice {
    USD: number;
}
export interface BinanceBtcPrice {
    mins: number;
    price: string;
    closeTime: number;
}
export interface CmcQuotesData {
    data: {
        [id: string]: {
            quote: {
                USD: {
                    price: number;
                };
            };
        };
    };
}
export interface OdosUsdPrice {
    data: {
        priceUsd: string;
    };
}
export interface UsdPrice {
    USD: number;
}
export interface FeeRecommended {
    [blockNumber: string]: number;
}
export interface BtcRbf {
    replaces?: string[];
}
export interface UtxoSpendInfo {
    spent: boolean;
    txid?: string;
    vin?: number;
    status?: {
        confirmed: boolean;
    };
}
