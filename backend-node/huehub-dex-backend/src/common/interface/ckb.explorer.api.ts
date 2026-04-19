export interface XudtTypeScript {
    args: string;
    codeHash: string;
    hashType: string;
}
export interface ExplorerAttributes {
    symbol: string;
    fullName: string;
    iconFile: string;
    published: boolean;
    description: string;
    typeHash: string;
    typeScript: XudtTypeScript;
    issuerAddress: string;
    displayName: string;
    uan: string;
    udtType: string;
    operatorWebsite: string;
    email: string;
    totalAmount: string;
    addressesCount: string;
    decimal: string;
    h24CkbTransactionsCount: string;
    createdAt: string;
    xudtTags: string[];
}
export interface ExplorerData {
    attributes: ExplorerAttributes;
}
export interface ExplorerMeta {
    total: number;
    page_size: number;
}
export interface ExplorerResponse {
    data: ExplorerData[];
    meta: ExplorerMeta;
}
