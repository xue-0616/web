// Ambient module declarations for @unipasswallet/* packages.
// These are internal packages from the unipass-wallet-js-github monorepo.
// Types are declared loosely (any) to satisfy the TS compiler.

declare module '@unipasswallet/abi' {
    export const dkimKeys: any;
    export const moduleMain: any;
}

declare module '@unipasswallet/dkim' {
    export const DkimParams: any;
    export const DkimParamsBase: any;
}

declare module '@unipasswallet/keys' {
    export const getDkimVerifyMessage: any;
    export const KeyEmailDkim: any;
    export const KeyEmailDkimSignType: any;
    export const KeyERC1271: any;
    export const KeyOpenIDSignType: any;
    export const KeySecp256k1: any;
    export const KeySecp256k1Wallet: any;
    export const Keyset: any;
    export const RoleWeight: any;
    export const sign: any;
    export const SignType: any;
}

declare module '@unipasswallet/network' {
    export const MAINNET_UNIPASS_WALLET_CONTEXT: any;
    export const TESTNET_UNIPASS_WALLET_CONTEXT: any;
}

declare module '@unipasswallet/relayer' {
    export const RpcRelayer: any;
}

declare module '@unipasswallet/transaction-builders' {
    export const CallTxBuilder: any;
    export const CancelLockKeysetHashTxBuilder: any;
    export const SyncAccountTxBuilder: any;
    export const UnlockKeysetHashTxBuilder: any;
    export const UpdateKeysetHashTxBuilder: any;
    export const UpdateKeysetHashWithTimeLockTxBuilder: any;
}

declare module '@unipasswallet/transactions' {
    export const CallType: any;
    export const digestGuestTxHash: any;
    export const digestTxHash: any;
}

declare module '@unipasswallet/utils' {
    export const subDigest: any;
}

declare module '@unipasswallet/wallet' {
    export const getWalletDeployTransaction: any;
    export const Wallet: any;
}
