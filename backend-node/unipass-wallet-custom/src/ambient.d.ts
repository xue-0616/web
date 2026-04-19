// Ambient module shims for decompiled unipass-wallet-custom.
// @unipasswallet/* packages are not published on npm; these stubs let tsc pass.
declare module '@unipasswallet/keys' {
  export class Keyset {
    static create(...args: any[]): any;
    static fromJson(...args: any[]): any;
    [key: string]: any;
  }
  export class KeyEmailDkim { constructor(...args: any[]); [key: string]: any; }
  export const Keys: any;
  const _default: any;
  export default _default;
}
declare module '@unipasswallet/relayer' {
  export class RpcRelayer { constructor(...args: any[]); [key: string]: any; }
}
declare module '@unipasswallet/network' {
  export const MAINNET_UNIPASS_WALLET_CONTEXT: any;
}
declare module '@unipasswallet/wallet' {
  export class Wallet {
    constructor(...args: any[]);
    static create(...args: any[]): any;
    [key: string]: any;
  }
}
declare module '@unipasswallet/transactions' {
  export function digestTxHash(...args: any[]): any;
}

// TypeScript helpers emitted by tsc into decompiled CJS output
declare function __importDefault<T = any>(mod: T): { default: T } & T;
declare function __decorate(...args: any[]): any;
declare function __metadata(...args: any[]): any;
declare function __importStar<T = any>(mod: T): T;
declare function __awaiter(...args: any[]): any;
declare function __generator(...args: any[]): any;
