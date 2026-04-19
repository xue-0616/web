export interface FeeInfo {
    chainId: string;
    date: Date | string | undefined;
    gasFee: string;
    feeToken?: string;
    feeAmount?: string;
    submitter?: string;
    address?: string;
    chainTxHash?: string;
    discount?: string | number;
    functionAbis?: any;
    data?: any[] | null;
    app?: string;
    gasLimit?: string;
    gasPrice?: string;
}

export interface CustomTxFee {
    chainTxHash: string;
    userPaidGas?: string | number;
    consumedFee?: string | number;
    tankPaidGas?: string | number;
    discount?: number;
}

export interface GasConsumeDetailsInfo {
    chainId: string;
    date: string;
    gasFee: string;
    feeAmount: string;
    submitter?: string;
    address?: string;
    chainTxHash?: string;
    discount?: string;
    functionAbis?: any;
    app?: string;
}

export interface getPaymentTransactionList {
    chainId: string;
    gasPrice: string;
    gasLimit: string;
    chainTxHash: string;
    feeAmount?: string;
    feeToken?: string;
    date: string;
}

export interface ParsePayment {
    address: string;
    id: string | number;
    paymentAmount?: string | number;
    feeAmount?: string | number;
    freeQuota?: number;
    date: string;
    output: string[];
    input: string[];
    outputTo?: string;
    outputTokenAddress?: string;
    outputChainId?: string;
    outputAmount?: string | number;
    subOutputTo?: string;
    subTokenAddress?: string;
    subAmount?: string | number;
    subPaymentType?: number;
    inputTxHash?: string;
    inputChainId?: string;
}

export interface PaymentAccount {
    address: string;
    provider: number;
    date: string;
}

export interface SnapPaymentRegisterInfo {
    date: string;
    day: string;
    app: string;
    address?: string[];
    apple: number;
    google: number;
    totalRegister: number;
    deployed: number;
    notDeployed: number;
    metamask: number;
    bnbCount: number;
    arbCount: number;
    polygonCount: number;
}

export interface DeployInfo {
    all: number;
    polygon: number;
    bsc: number;
    arb: number;
}

export interface PaymentTableInfo {
    [key: string]: any;
}

export interface BatchPaymentTableInfo {
    [key: string]: any;
}

export interface PaymentData {
    [key: string]: any;
}
