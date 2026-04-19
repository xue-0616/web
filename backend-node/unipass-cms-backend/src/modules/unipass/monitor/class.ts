export interface OpenIdPublicKeyInfo {
    publicKey: string;
    mapKey: string;
}

export interface OpenIdInfo {
    publicKey: string;
    kid: string;
    certsUrl: string;
}

export interface DkimKeyInfo {
    publicKey: string;
    emailServer: string;
    selector: string;
    sdid: string;
}

export interface DkimKeyDNSInfo {
    hostname: string;
    dkimInfo: string;
    publicKey: string;
    key?: string;
}

export interface EventDbInfo {
    blockNumber: string;
    topics: string;
    createdAt: Date;
    updatedAt: Date;
    address: string;
    transactionHash: string;
    email: string;
    source: string;
}
