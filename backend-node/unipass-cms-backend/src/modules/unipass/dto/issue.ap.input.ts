export enum WalletHost {
    LocalHost = "http://localhost:3001",
    dev = "https://d.wallet.unipass.vip/wallet-v2",
    test = "https://t.wallet.unipass.vip/wallet-v2",
    preview = "https://m.wallet.unipass.vip/wallet-v2",
    testnet = "https://testnet.wallet.unipass.id/wallet-v2",
    mainnet = "https://wallet.unipass.id/wallet-v2",
}

export class ApIssueInfo {
    address!: string;
    ap!: string;
}

export class IssueActionPointInput {
    address!: string;
    walletHost!: string;
    message?: string;
    discount?: string;
}

export class AdminGetActionPointBalanceInput {
    address!: string;
    walletHost!: string;
}
